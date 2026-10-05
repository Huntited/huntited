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

export class RegistryError extends Error {
  constructor(
    public readonly code: "not_found" | "closed" | "already_committed" | "not_settleable",
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
    return {
      id: hunt.id,
      title: hunt.title,
      description: hunt.description,
      location: hunt.location,
      deadline: hunt.deadline,
      threshold: hunt.threshold,
      progressVisibility: hunt.progressVisibility,
      status,
      commitCount: masked ? null : this.commitCount(hunt.id),
      createdAt: hunt.createdAt,
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
    const key = commitKeyFor(huntId, walletKey);
    return this.commits.get(huntId)?.some((c) => c.commitKey === key) ? "participant" : undefined;
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

  /** Engage un wallet. Renvoie sa position (1 = premier). */
  commit(huntId: string, walletKey: string): { rank: number; hunt: StoredHunt } {
    const hunt = this.hunts.get(huntId);
    if (!hunt) throw new RegistryError("not_found", "Chasse introuvable.");
    if (this.status(hunt) !== "active") {
      throw new RegistryError("closed", "Les engagements sont fermés pour cette chasse.");
    }
    const list = this.commits.get(huntId) ?? [];
    const key = commitKeyFor(huntId, walletKey);
    if (list.some((c) => c.commitKey === key)) {
      throw new RegistryError("already_committed", "Tu es déjà engagé·e dans cette chasse.");
    }
    const iso = new Date(this.now()).toISOString();
    list.push({ huntId, commitKey: key, createdAt: iso });
    this.commits.set(huntId, list);
    // Activation au moment où le seuil est atteint (avant la deadline).
    if (list.length >= hunt.threshold && !hunt.activatedAt) hunt.activatedAt = iso;
    this.save();
    return { rank: list.length, hunt };
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
