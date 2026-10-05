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
  createHuntCovenant,
  getCommitCount,
  getHunt,
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
import { hasMockCommitment } from "./mock-zk";
import { getMyCommitment, rememberCommitment } from "./my-commitments";
import type { Hunt, HuntFormData, HuntStatus, ProgressVisibility } from "./types";

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
  const stored = deriveAndPersistHuntState(base, count, now);
  const hunt: Hunt = {
    ...base,
    ...(stored.activatedAt ? { activatedAt: stored.activatedAt } : {}),
    ...(stored.settledAt ? { settledAt: stored.settledAt } : {}),
  };
  return {
    hunt,
    status: deriveHuntStatus(base, count, now, stored),
    commitCount: count,
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

/** Engage le wallet (5 KAS simulés). */
export async function commit(huntId: string, address: string): Promise<void> {
  if (getDataMode() === "local") {
    await localCommit(huntId, address);
    return;
  }
  try {
    const token = await getSessionToken(address);
    const r = await apiFetch<{ rank: number }>(
      "POST",
      `/api/hunts/${encodeURIComponent(huntId)}/commit`,
      {},
      token,
    );
    rememberCommitment(address, huntId, { rank: r.rank, committedAt: Date.now() });
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

/** Résolution simulée (développement uniquement) : aucun KAS transféré. */
export async function settleHunt(huntId: string, outcome: SettlementOutcome): Promise<void> {
  if (getDataMode() === "local") {
    markHuntSettled(huntId, outcome);
    return;
  }
  await apiFetch("POST", `/api/hunts/${encodeURIComponent(huntId)}/settle`, {});
  notify();
}
