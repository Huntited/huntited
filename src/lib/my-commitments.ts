// Mémoire locale des engagements de ce wallet (mode registre partagé).
// Sert à afficher « Déjà engagé·e » et à calculer les badges sans signature
// à chaque visite. Le serveur reste l'autorité (il refuse un double
// engagement). Indexé par une empreinte du wallet, jamais par l'adresse.
import { badgeWalletKey } from "./badge-store";

export const MY_COMMITMENTS_KEY = "huntited:my-commitments";

export interface MyCommitment {
  /** Position de l'engagement (1 = premier), si connue. */
  rank?: number;
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

export function rememberCommitment(address: string, huntId: string, c: MyCommitment): void {
  if (typeof window === "undefined") return;
  const all = read();
  const key = badgeWalletKey(address);
  all[key] = { ...(all[key] ?? {}), [huntId]: c };
  window.localStorage.setItem(MY_COMMITMENTS_KEY, JSON.stringify(all));
}

export function getMyCommitment(address: string, huntId: string): MyCommitment | undefined {
  return read()[badgeWalletKey(address)]?.[huntId];
}

export function listMyCommitments(address: string): Record<string, MyCommitment> {
  return read()[badgeWalletKey(address)] ?? {};
}
