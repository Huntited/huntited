// Accès unique aux chasses, selon VITE_DATA_MODE :
//   "local" → démos + chasses de ce navigateur (localStorage) — par défaut ;
//   "api"   → registre partagé du backend (plusieurs appareils, plusieurs
//             personnes) ; créer et s'engager exigent la session signée.
// Les écrans ne dépendent que de cette interface : remplacer le backend par
// un indexeur on-chain Kaspa ne changera que ce fichier.
import { ApiError, apiFetch, getSessionToken } from "./api-client";
import {
  COMMIT_DEPOSIT_KAS,
  CREATE_DEPOSIT_KAS,
  commitToHunt as localCommit,
  commitsOpen as localCommitsOpen,
  createHuntCovenant,
  getCommitCount,
  getHunt,
  getRetainedGroup,
  listHunts,
  onCommitmentsChange,
} from "./covenants";
import { deriveHuntStatus } from "./hunt-lifecycle";
import {
  deriveAndPersistHuntState,
  markHuntSettled,
  subscribeHuntState,
  type SettlementOutcome,
} from "./hunt-state-store";
import { getMockPersonalThreshold, hasMockCommitment } from "./mock-zk";
import { getMyCommitment, rememberCommitment } from "./my-commitments";
import { isRetained } from "./retained-group";
import type { Hunt, HuntFormData, HuntStatus, ProgressVisibility } from "./types";
import { addUserHunt } from "./user-hunts";

export type DataMode = "local" | "api";

export function getDataMode(): DataMode {
  return import.meta.env["VITE_DATA_MODE"] === "api" ? "api" : "local";
}

/** Une chasse et son état courant. */
export interface HuntView {
  hunt: Hunt;
  status: HuntStatus;
  /** null quand le serveur masque le compteur (progression masquée, phase active). */
  commitCount: number | null;
  /** Taille du groupe retenu (seuils personnels) ; null si masquée. */
  retainedCount: number | null;
  /** Seuil personnel maximal satisfait (k*) ; null sans groupe ou si masqué. */
  retainedThreshold: number | null;
  /** Engagement qui a déclenché l'activation, s'il est connu. */
  activationRank?: number;
  /** Engagements encore acceptés (active, ou activée avant la date limite). */
  commitsOpen: boolean;
  outcome?: SettlementOutcome;
}

export class HuntActionError extends Error {}

// --- Changements (rafraîchissement des écrans) ---------------------------------

const CHANGE_EVENT = "huntited:registry-changed";
const notify = () => {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CHANGE_EVENT));
};

export function onHuntsChange(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CHANGE_EVENT, listener);
  const unsubs = [onCommitmentsChange(listener), subscribeHuntState(listener)];
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    unsubs.forEach((u) => u());
  };
}

// --- Mode local ---------------------------------------------------------------

function localView(base: Hunt, now = Date.now()): HuntView {
  const count = getCommitCount(base);
  const group = getRetainedGroup(base);
  // L'activation se fonde sur le groupe retenu (seuils personnels).
  const stored = deriveAndPersistHuntState(base, group.retainedCount, now, count);
  const hunt: Hunt = {
    ...base,
    ...(stored.activatedAt ? { activatedAt: stored.activatedAt } : {}),
    ...(stored.settledAt ? { settledAt: stored.settledAt } : {}),
  };
  return {
    hunt,
    status: deriveHuntStatus(base, group.retainedCount, now, stored),
    commitCount: count,
    retainedCount: group.retainedCount,
    retainedThreshold: group.retainedThreshold,
    commitsOpen: localCommitsOpen(base, now),
    ...(stored.activationRank !== undefined ? { activationRank: stored.activationRank } : {}),
    ...(stored.settlementOutcome ? { outcome: stored.settlementOutcome } : {}),
  };
}

// --- Mode API -----------------------------------------------------------------

interface PublicHunt {
  id: string;
  title: string;
  description: string;
  location: string;
  deadline: string;
  threshold: number;
  progressVisibility: ProgressVisibility;
  status: "active" | "activated" | "expired" | "settled";
  commitCount: number | null;
  retainedCount: number | null;
  retainedThreshold: number | null;
  activationRank?: number;
  commitsOpen: boolean;
  outcome?: SettlementOutcome;
  activatedAt?: string;
  settledAt?: string;
}

function apiView(p: PublicHunt): HuntView {
  return {
    hunt: {
      id: p.id,
      title: p.title,
      description: p.description,
      location: p.location,
      deadline: p.deadline,
      threshold: p.threshold,
      deposit: CREATE_DEPOSIT_KAS,
      commitDeposit: COMMIT_DEPOSIT_KAS,
      commitCount: p.commitCount ?? 0,
      status: p.status,
      progressVisibility: p.progressVisibility,
      ...(p.activatedAt ? { activatedAt: p.activatedAt } : {}),
      ...(p.settledAt ? { settledAt: p.settledAt } : {}),
    },
    status: p.status,
    commitCount: p.commitCount,
    retainedCount: p.retainedCount ?? null,
    retainedThreshold: p.retainedThreshold ?? null,
    commitsOpen: p.commitsOpen ?? p.status === "active",
    ...(p.activationRank !== undefined ? { activationRank: p.activationRank } : {}),
    ...(p.outcome ? { outcome: p.outcome } : {}),
  };
}

const actionError = (e: unknown, fallback: string) =>
  new HuntActionError(
    e instanceof ApiError && e.reason === "signature_refused"
      ? "Signature refusée : signe le message dans ton wallet pour continuer."
      : e instanceof ApiError && e.reason === "unavailable"
        ? "Le service est temporairement indisponible. Réessaie."
        : e instanceof ApiError && e.message !== e.reason
          ? e.message
          : fallback,
  );

// --- Interface publique ---------------------------------------------------------

export async function listHuntViews(): Promise<HuntView[]> {
  if (getDataMode() === "local") return listHunts().map((h) => localView(h));
  const list = await apiFetch<PublicHunt[]>("GET", "/api/hunts");
  return (Array.isArray(list) ? list : []).map(apiView);
}

export async function getHuntView(id: string): Promise<HuntView | undefined> {
  if (getDataMode() === "local") {
    const h = getHunt(id);
    return h ? localView(h) : undefined;
  }
  try {
    return apiView(await apiFetch<PublicHunt>("GET", `/api/hunts/${encodeURIComponent(id)}`));
  } catch (e) {
    if (e instanceof ApiError && e.reason === "not_found") return undefined;
    throw e;
  }
}

/** Crée une chasse ; renvoie son identifiant. */
export async function createHunt(data: HuntFormData, address: string): Promise<string> {
  if (getDataMode() === "local") return (await createHuntCovenant(data)).huntId;
  try {
    const token = await getSessionToken(address);
    const created = await apiFetch<PublicHunt>(
      "POST",
      "/api/hunts",
      {
        title: data.title.trim(),
        description: data.description.trim(),
        location: data.location.trim(),
        deadline: new Date(data.deadline).toISOString(),
        threshold: data.threshold,
        progressVisibility: data.progressVisibility ?? "visible",
      },
      token,
    );
    notify();
    return created.id;
  } catch (e) {
    throw actionError(e, "La création de la chasse a échoué. Réessaie.");
  }
}

/** true si ce wallet est (connu comme) engagé dans la chasse. */
export function isCommitted(huntId: string, address: string): boolean {
  return getDataMode() === "local"
    ? hasMockCommitment(huntId, address)
    : getMyCommitment(address, huntId) !== undefined;
}

/**
 * Mode local : true / false selon que ce wallet fait partie du groupe retenu.
 * Mode registre : undefined (c'est le serveur qui décide, via le jeton de chat).
 */
export function isRetainedHere(huntId: string, address: string): boolean | undefined {
  if (getDataMode() !== "local") return undefined;
  const hunt = getHunt(huntId);
  if (!hunt) return false;
  const mine = getMockPersonalThreshold(huntId, address, hunt.threshold);
  return mine !== undefined && isRetained(mine, getRetainedGroup(hunt));
}

/** Seuil personnel de ce wallet dans la chasse, s'il est connu sur cet appareil. */
export function getMyPersonalThreshold(hunt: Hunt, address: string): number | undefined {
  return getDataMode() === "local"
    ? getMockPersonalThreshold(hunt.id, address, hunt.threshold)
    : getMyCommitment(address, hunt.id)?.personalThreshold;
}

/**
 * Engage le wallet (5 KAS simulés), avec un seuil personnel facultatif :
 * « je viens si au moins N personnes viennent » (N ≥ seuil de la chasse).
 */
export async function commit(
  huntId: string,
  address: string,
  personalThreshold?: number,
): Promise<void> {
  if (getDataMode() === "local") {
    await localCommit(huntId, address, personalThreshold);
    return;
  }
  try {
    const token = await getSessionToken(address);
    // Rang null : chasse à progression masquée encore active (révélé plus tard).
    const r = await apiFetch<{ rank: number | null; hunt: PublicHunt }>(
      "POST",
      `/api/hunts/${encodeURIComponent(huntId)}/commit`,
      personalThreshold === undefined ? {} : { personalThreshold },
      token,
    );
    rememberCommitment(address, huntId, {
      committedAt: Date.now(),
      personalThreshold: personalThreshold ?? r.hunt.threshold,
      ...(r.rank !== null ? { rank: r.rank } : {}),
    });
    notify();
  } catch (e) {
    // Déjà engagé·e (autre appareil, cache vidé) : on s'en souvient localement.
    if (e instanceof ApiError && e.code === "already_committed") {
      rememberCommitment(address, huntId, { committedAt: Date.now() });
      notify();
    }
    throw actionError(e, "L'engagement a échoué. Réessaie.");
  }
}

/** Chasses dans lesquelles ce wallet est (connu comme) engagé. */
export async function listMyEngagements(address: string): Promise<HuntView[]> {
  const views = await listHuntViews();
  return views.filter((v) => isCommitted(v.hunt.id, address));
}

export interface SyncResult {
  created: number;
  commitments: number;
}

/**
 * Mode registre : récupère l'activité du wallet sur le serveur (chasses
 * créées, engagements et rangs révélés) pour retrouver « Mes chasses » et les
 * badges sur cet appareil. Demande une signature si aucune session n'est ouverte.
 */
export async function syncMyActivity(address: string): Promise<SyncResult> {
  if (getDataMode() === "local") return { created: 0, commitments: 0 };
  try {
    const token = await getSessionToken(address);
    const me = await apiFetch<{
      created: PublicHunt[];
      commitments: {
        hunt: PublicHunt;
        rank: number | null;
        committedAt: string;
        personalThreshold?: number;
      }[];
    }>("GET", "/api/me", undefined, token);
    for (const h of me.created) {
      addUserHunt(address, {
        huntId: h.id,
        title: h.title,
        location: h.location,
        deadline: h.deadline,
        threshold: h.threshold,
      });
    }
    for (const c of me.commitments) {
      rememberCommitment(address, c.hunt.id, {
        committedAt: Date.parse(c.committedAt) || Date.now(),
        ...(c.personalThreshold !== undefined ? { personalThreshold: c.personalThreshold } : {}),
        ...(c.rank !== null ? { rank: c.rank } : {}),
      });
    }
    notify();
    return { created: me.created.length, commitments: me.commitments.length };
  } catch (e) {
    throw actionError(e, "La synchronisation a échoué. Réessaie.");
  }
}

/** Résolution simulée (développement uniquement) : aucun KAS transféré. */
export async function settleHunt(huntId: string, outcome: SettlementOutcome): Promise<void> {
  if (getDataMode() === "local") {
    markHuntSettled(huntId, outcome);
    return;
  }
  await apiFetch("POST", `/api/hunts/${encodeURIComponent(huntId)}/settle`, {});
  notify();
}
