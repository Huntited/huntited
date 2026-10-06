// Registre partagé des chasses et des engagements (prototype, sans KAS réels).
// Source d'autorité pour les statuts et les rôles (accès au chat).
// Persistance optionnelle dans un fichier JSON ; sinon en mémoire.
// Confidentialité : aucune adresse stockée. Le créateur est identifié par
// l'empreinte de son wallet ; chaque engagement par une empreinte propre à
// la chasse (impossible de relier deux engagements d'un même wallet sans
// connaître l'adresse).
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import type { ChatRole, HuntAccessStatus, HuntOutcome } from "../types/auth.js";
import type {
  NewHuntInput,
  PublicHunt,
  RegistryHuntStatus,
  StoredCommit,
  StoredHunt,
} from "../types/hunt.js";
import type { HuntAccessStore } from "./hunt-access-store.js";
import { computeRetainedGroup, isRetained, type RetainedGroup } from "./retained-group.js";

/** Seuil personnel maximal accepté (comme le seuil d'une chasse). */
export const MAX_PERSONAL_THRESHOLD = 100_000;

export class RegistryError extends Error {
  constructor(
    public readonly code:
      | "not_found"
      | "closed"
      | "already_committed"
      | "person_already_committed"
      | "not_settleable"
      | "invalid_threshold",
    message: string,
  ) {
    super(message);
  }
}

/** Empreinte d'engagement : propre à la chasse et au wallet. */
export function commitKeyFor(huntId: string, walletKey: string): string {
  return createHash("sha256").update(`huntited:commit|${huntId}|${walletKey}`).digest("hex");
}

interface RegistryData {
  hunts: StoredHunt[];
  commits: StoredCommit[];
}

export interface HuntRegistryOptions {
  /** Fichier JSON de persistance ; absent = mémoire uniquement. */
  file?: string;
  now?: () => number;
}

export class HuntRegistry implements HuntAccessStore {
  private readonly hunts = new Map<string, StoredHunt>();
  private readonly commits = new Map<string, StoredCommit[]>();
  private readonly now: () => number;

  constructor(private readonly options: HuntRegistryOptions = {}) {
    this.now = options.now ?? Date.now;
    this.load();
  }

  // --- Lecture -------------------------------------------------------------

  get(id: string): StoredHunt | undefined {
    return this.hunts.get(id);
  }

  list(): StoredHunt[] {
    return [...this.hunts.values()];
  }

  commitCount(huntId: string): number {
    return this.commits.get(huntId)?.length ?? 0;
  }

  /** Seuil personnel effectif d'un engagement (anciens engagements : seuil de la chasse). */
  private personalThreshold(hunt: StoredHunt, c: StoredCommit): number {
    return c.personalThreshold ?? hunt.threshold;
  }

  /** Groupe retenu courant (voir docs/seuil-personnel.md). */
  group(hunt: StoredHunt): RetainedGroup {
    const list = this.commits.get(hunt.id) ?? [];
    return computeRetainedGroup(
      list.map((c) => this.personalThreshold(hunt, c)),
      hunt.threshold,
    );
  }

  /**
   * Engagements acceptés : tant que la chasse n'est pas résolue et que la date
   * limite n'est pas passée — y compris après l'activation (le groupe retenu
   * peut grandir jusqu'à la date limite).
   */
  commitsOpen(hunt: StoredHunt): boolean {
    return !hunt.outcome && this.now() <= Date.parse(hunt.deadline);
  }

  /** L'activation prime sur l'expiration ; « settled » est définitif. */
  status(hunt: StoredHunt): RegistryHuntStatus {
    if (hunt.outcome) return "settled";
    if (hunt.activatedAt) return "activated";
    if (this.now() > Date.parse(hunt.deadline)) return "expired";
    return "active";
  }

  publicView(hunt: StoredHunt): PublicHunt {
    const status = this.status(hunt);
    const masked = hunt.progressVisibility === "hidden" && status === "active";
    const group = this.group(hunt);
    return {
      id: hunt.id,
      title: hunt.title,
      description: hunt.description,
      location: hunt.location,
      ...(hunt.country ? { country: hunt.country } : {}),
      deadline: hunt.deadline,
      threshold: hunt.threshold,
      deposit: hunt.deposit ?? 30,
      progressVisibility: hunt.progressVisibility,
      status,
      commitCount: masked ? null : this.commitCount(hunt.id),
      retainedCount: masked ? null : group.retainedCount,
      retainedThreshold: masked ? null : group.retainedThreshold,
      commitsOpen: this.commitsOpen(hunt),
      createdAt: hunt.createdAt,
      ...(hunt.activationRank !== undefined && !masked
        ? { activationRank: hunt.activationRank }
        : {}),
      ...(hunt.outcome ? { outcome: hunt.outcome } : {}),
      ...(hunt.activatedAt ? { activatedAt: hunt.activatedAt } : {}),
      ...(hunt.settledAt ? { settledAt: hunt.settledAt } : {}),
    };
  }

  // --- HuntAccessStore (accès au chat) ---------------------------------------

  getHuntStatus(huntId: string): HuntAccessStatus | undefined {
    const hunt = this.hunts.get(huntId);
    return hunt ? this.status(hunt) : undefined;
  }

  getHuntOutcome(huntId: string): HuntOutcome | undefined {
    return this.hunts.get(huntId)?.outcome;
  }

  getWalletRole(huntId: string, walletKey: string): ChatRole | undefined {
    const hunt = this.hunts.get(huntId);
    if (!hunt) return undefined;
    if (hunt.creatorKey === walletKey) return "creator";
    // Seuls les engagé·es retenu·es participent (et accèdent au chat).
    const key = commitKeyFor(huntId, walletKey);
    const mine = this.commits.get(huntId)?.find((c) => c.commitKey === key);
    if (!mine) return undefined;
    return isRetained(this.personalThreshold(hunt, mine), this.group(hunt))
      ? "participant"
      : undefined;
  }

  // --- Écriture --------------------------------------------------------------

  create(input: NewHuntInput, creatorKey: string): StoredHunt {
    const hunt: StoredHunt = {
      id: randomBytes(12).toString("hex"),
      ...input,
      creatorKey,
      createdAt: new Date(this.now()).toISOString(),
    };
    this.hunts.set(hunt.id, hunt);
    this.commits.set(hunt.id, []);
    this.save();
    return hunt;
  }

  /**
   * Engage un wallet avec son seuil personnel (par défaut : seuil de la
   * chasse). Renvoie sa position (1 = premier).
   */
  commit(
    huntId: string,
    walletKey: string,
    personalThreshold?: number,
    personKey?: string,
  ): { rank: number; hunt: StoredHunt } {
    const hunt = this.hunts.get(huntId);
    if (!hunt) throw new RegistryError("not_found", "Chasse introuvable.");
    if (!this.commitsOpen(hunt)) {
      throw new RegistryError("closed", "Les engagements sont fermés pour cette chasse.");
    }
    const t = personalThreshold ?? hunt.threshold;
    if (!Number.isInteger(t) || t < hunt.threshold || t > MAX_PERSONAL_THRESHOLD) {
      throw new RegistryError(
        "invalid_threshold",
        `Ton seuil personnel doit être un entier d'au moins ${hunt.threshold}.`,
      );
    }
    const list = this.commits.get(huntId) ?? [];
    const key = commitKeyFor(huntId, walletKey);
    if (list.some((c) => c.commitKey === key)) {
      throw new RegistryError("already_committed", "Tu es déjà engagé·e dans cette chasse.");
    }
    if (personKey !== undefined && list.some((c) => c.personKey === personKey)) {
      throw new RegistryError(
        "person_already_committed",
        "Ce pass est déjà engagé dans cette chasse (une personne = un engagement).",
      );
    }
    const iso = new Date(this.now()).toISOString();
    list.push({
      huntId,
      commitKey: key,
      createdAt: iso,
      ...(t !== hunt.threshold ? { personalThreshold: t } : {}),
      ...(personKey !== undefined ? { personKey } : {}),
    });
    this.commits.set(huntId, list);
    // Activation dès que le groupe retenu existe (il atteint alors le seuil).
    if (!hunt.activatedAt && this.group(hunt).retainedThreshold !== null) {
      hunt.activatedAt = iso;
      hunt.activationRank = list.length;
    }
    this.save();
    return { rank: list.length, hunt };
  }

  /**
   * Rang affichable : masqué (null) tant qu'une chasse à progression masquée
   * est en phase d'engagement — sinon il révélerait le compteur.
   */
  visibleRank(hunt: StoredHunt, rank: number): number | null {
    return hunt.progressVisibility === "hidden" && this.status(hunt) === "active" ? null : rank;
  }

  /**
   * Activité d'un wallet : chasses créées et engagements (rang, seuil
   * personnel, retenu ou non). « Retenu » ne révèle rien de masqué : tant
   * qu'une chasse est active, aucun groupe n'existe et personne n'est retenu.
   */
  activityFor(walletKey: string): {
    created: StoredHunt[];
    commitments: {
      hunt: StoredHunt;
      rank: number;
      committedAt: string;
      personalThreshold: number;
      retained: boolean;
    }[];
  } {
    const created = this.list().filter((h) => h.creatorKey === walletKey);
    const commitments = this.list().flatMap((hunt) => {
      const key = commitKeyFor(hunt.id, walletKey);
      const list = this.commits.get(hunt.id) ?? [];
      const i = list.findIndex((c) => c.commitKey === key);
      if (i < 0) return [];
      const t = this.personalThreshold(hunt, list[i]!);
      return [
        {
          hunt,
          rank: i + 1,
          committedAt: list[i]!.createdAt,
          personalThreshold: t,
          retained: isRetained(t, this.group(hunt)),
        },
      ];
    });
    return { created, commitments };
  }

  /** Résolution simulée : succès si activée, échec si expirée. Aucun KAS transféré. */
  settle(huntId: string): StoredHunt {
    const hunt = this.hunts.get(huntId);
    if (!hunt) throw new RegistryError("not_found", "Chasse introuvable.");
    const status = this.status(hunt);
    if (status !== "activated" && status !== "expired") {
      throw new RegistryError("not_settleable", "La chasse ne peut pas encore être résolue.");
    }
    hunt.outcome = status === "activated" ? "success" : "failure";
    hunt.settledAt = new Date(this.now()).toISOString();
    this.save();
    return hunt;
  }

  // --- Persistance -------------------------------------------------------------

  private load() {
    const file = this.options.file;
    if (!file || !existsSync(file)) return;
    const data = JSON.parse(readFileSync(file, "utf8")) as RegistryData;
    for (const h of data.hunts ?? []) {
      this.hunts.set(h.id, h);
      this.commits.set(h.id, []);
    }
    for (const c of data.commits ?? []) this.commits.get(c.huntId)?.push(c);
  }

  private save() {
    const file = this.options.file;
    if (!file) return;
    const data: RegistryData = { hunts: this.list(), commits: [...this.commits.values()].flat() };
    mkdirSync(dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    writeFileSync(tmp, JSON.stringify(data, null, 2));
    renameSync(tmp, file); // écriture atomique
  }
}
