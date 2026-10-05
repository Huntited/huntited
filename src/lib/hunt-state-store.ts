/**
 * Store persistant (localStorage) des états mockés d'une chasse :
 * activation, expiration, résolution.
 *
 * Règles :
 * - "settled" n'est JAMAIS écrasé automatiquement ;
 * - "activated" reste prioritaire sur "expired" (une fois activée, toujours activée) ;
 * - aucune donnée personnelle : uniquement id de chasse, statut et dates.
 *
 * Remplacé plus tard par la lecture de l'état du covenant Kaspa.
 */
import type { Hunt } from "./types";

export const HUNT_STATES_KEY = "huntited:mock-hunt-states";
const CHANGE_EVENT = "huntited:hunt-states-changed";

export type StoredStatus = "active" | "activated" | "expired" | "settled";
export type SettlementOutcome = "success" | "failure";

export interface StoredHuntState {
  huntId: string;
  status: StoredStatus;
  activatedAt?: string;
  /** Nombre d'engagements au moment de l'activation (badge Déclencheur·se). */
  activationRank?: number;
  expiredAt?: string;
  settledAt?: string;
  settlementOutcome?: SettlementOutcome;
  updatedAt: string;
}

const isBrowser = () => typeof window !== "undefined";

function readAll(): Record<string, StoredHuntState> {
  if (!isBrowser()) return {};
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(HUNT_STATES_KEY) ?? "{}");
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, StoredHuntState>)
      : {};
  } catch {
    return {};
  }
}

export function getStoredHuntState(huntId: string): StoredHuntState | undefined {
  return readAll()[huntId];
}

export function setStoredHuntState(state: StoredHuntState): void {
  if (!isBrowser()) return;
  const all = readAll();
  all[state.huntId] = state;
  window.localStorage.setItem(HUNT_STATES_KEY, JSON.stringify(all));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/**
 * Calcule le statut à partir du groupe retenu et de la deadline, puis le
 * persiste. Ne réécrit rien si l'état est inchangé (évite les boucles de rendu).
 * `retainedCount` : taille du groupe retenu (= nombre d'engagés sans seuils
 * personnels) ; `totalCommits` : nombre total d'engagements (rang d'activation).
 */
export function deriveAndPersistHuntState(
  hunt: Pick<Hunt, "id" | "threshold" | "deadline">,
  retainedCount: number,
  now: number = Date.now(),
  totalCommits: number = retainedCount,
): StoredHuntState {
  const prev = getStoredHuntState(hunt.id);
  if (prev?.status === "settled") return prev; // jamais écrasé
  if (prev?.status === "activated") return prev; // l'activation prime

  const iso = new Date(now).toISOString();
  let next: StoredHuntState;
  if (retainedCount >= hunt.threshold) {
    next = {
      huntId: hunt.id,
      status: "activated",
      activatedAt: iso,
      activationRank: totalCommits,
      updatedAt: iso,
    };
  } else if (now > new Date(hunt.deadline).getTime()) {
    if (prev?.status === "expired") return prev;
    next = { huntId: hunt.id, status: "expired", expiredAt: iso, updatedAt: iso };
  } else {
    if (prev?.status === "active") return prev;
    next = { huntId: hunt.id, status: "active", updatedAt: iso };
  }
  setStoredHuntState(next);
  return next;
}

/** Résolution simulée. Sans effet si la chasse est déjà résolue. */
export function markHuntSettled(
  huntId: string,
  outcome: SettlementOutcome,
): StoredHuntState | undefined {
  const prev = getStoredHuntState(huntId);
  if (prev?.status === "settled") return prev;
  const iso = new Date().toISOString();
  const next: StoredHuntState = {
    ...(prev ?? { huntId }),
    huntId,
    status: "settled",
    settledAt: iso,
    settlementOutcome: outcome,
    updatedAt: iso,
  };
  setStoredHuntState(next);
  return next;
}

/** Abonnement aux changements (même onglet + autres onglets). */
export function subscribeHuntState(listener: () => void): () => void {
  if (!isBrowser()) return () => {};
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}
