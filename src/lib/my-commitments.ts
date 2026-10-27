// Mémoire locale des engagements de ce wallet (mode registre partagé).
// Sert à afficher « Déjà engagé·e » et à calculer les badges sans signature
// à chaque visite. Le serveur reste l'autorité (il refuse un double
// engagement). Indexé par une empreinte du wallet, jamais par l'adresse.
import { badgeWalletKey } from "./badge-store";

export const MY_COMMITMENTS_KEY = "huntited:my-commitments";

export interface MyCommitment {
  /** Position de l'engagement (1 = premier), si connue. */
  rank?: number;
  /** Seuil personnel choisi (« je viens si au moins N »), si connu. */
  personalThreshold?: number;
  /** Engagement conditionnel : chasse qui doit se déclencher d'abord. */
  after?: string;
  committedAt: number;
}

type Store = Record<string, Record<string, MyCommitment>>;

function read(): Store {
  if (typeof window === "undefined") return {};
  try {
    const v: unknown = JSON.parse(window.localStorage.getItem(MY_COMMITMENTS_KEY) ?? "{}");
    return typeof v === "object" && v !== null ? (v as Store) : {};
  } catch {
    return {};
  }
}

/**
 * Mémorise (ou complète) un engagement : un rang déjà connu n'est jamais
 * effacé par une information plus pauvre (rang encore masqué).
 */
export function rememberCommitment(address: string, huntId: string, c: MyCommitment): void {
  if (typeof window === "undefined") return;
  const all = read();
  const key = badgeWalletKey(address);
  const prev = all[key]?.[huntId];
  const rank = c.rank ?? prev?.rank;
  const personalThreshold = c.personalThreshold ?? prev?.personalThreshold;
  const after = c.after ?? prev?.after;
  all[key] = {
    ...(all[key] ?? {}),
    [huntId]: {
      committedAt: prev ? Math.min(prev.committedAt, c.committedAt) : c.committedAt,
      ...(rank !== undefined ? { rank } : {}),
      ...(personalThreshold !== undefined ? { personalThreshold } : {}),
      ...(after !== undefined ? { after } : {}),
    },
  };
  window.localStorage.setItem(MY_COMMITMENTS_KEY, JSON.stringify(all));
}

/** Oublie un engagement retiré (message « withdraw » envoyé). */
export function forgetCommitment(address: string, huntId: string): void {
  if (typeof window === "undefined") return;
  const all = read();
  const key = badgeWalletKey(address);
  if (!all[key]?.[huntId]) return;
  delete all[key][huntId];
  window.localStorage.setItem(MY_COMMITMENTS_KEY, JSON.stringify(all));
}

export function getMyCommitment(address: string, huntId: string): MyCommitment | undefined {
  return read()[badgeWalletKey(address)]?.[huntId];
}

export function listMyCommitments(address: string): Record<string, MyCommitment> {
  return read()[badgeWalletKey(address)] ?? {};
}
