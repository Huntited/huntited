// Mock "ZK-lite" des engagements pour le MVP.
//
//   commitment        = SHA-256(huntId | secret aléatoire 32 octets)
//   walletFingerprint = SHA-256("huntited:wallet" | huntId | adresse)
//
// - Le secret n'est JAMAIS stocké ni loggé (mock : il est jeté après calcul).
// - L'adresse du wallet n'est JAMAIS stockée : seule une empreinte, propre à
//   chaque chasse (impossible de relier deux chasses entre elles), sert à
//   interdire le double engagement.
// - Aucun log de l'adresse, du secret ou du commitment.
//
// À remplacer par : arbre de Merkle des commitments + preuve ZK du
// compteur, vérifiés par le covenant Kaspa.

import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

export const RECORDS_KEY = "huntited:mock-commitments";
const CHANGE_EVENT = "huntited:commitments-changed";

/** Enregistrement stocké : aucun champ ne contient l'adresse brute. */
export interface CommitmentRecord {
  huntId: string;
  walletFingerprint: string;
  commitment: string;
  createdAt: number;
}

export interface MockCommitReceipt {
  huntId: string;
  commitment: string;
  createdAt: number;
}

const isBrowser = () => typeof window !== "undefined";

function readJson<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (!isBrowser()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function readRecords(): CommitmentRecord[] {
  const value = readJson<unknown>(RECORDS_KEY, []);
  if (!Array.isArray(value)) return [];
  return value.filter(
    (r): r is CommitmentRecord =>
      typeof r === "object" &&
      r !== null &&
      typeof r.huntId === "string" &&
      typeof r.walletFingerprint === "string" &&
      typeof r.commitment === "string" &&
      typeof r.createdAt === "number",
  );
}

/** Empreinte pseudonyme d'un wallet, propre à une chasse (synchrone). */
export function walletFingerprint(huntId: string, walletAddress: string): string {
  return bytesToHex(sha256(utf8ToBytes(`huntited:wallet|${huntId}|${walletAddress}`)));
}

/** true si ce wallet est déjà engagé dans cette chasse. */
export function hasMockCommitment(huntId: string, walletAddress: string): boolean {
  const fp = walletFingerprint(huntId, walletAddress);
  return readRecords().some((r) => r.huntId === huntId && r.walletFingerprint === fp);
}

/**
 * Position (1 = premier) et date de l'engagement de ce wallet parmi les
 * engagements locaux de la chasse, ou undefined s'il n'est pas engagé.
 */
export function getMockCommitPosition(
  huntId: string,
  walletAddress: string,
): { localRank: number; createdAt: number } | undefined {
  const fp = walletFingerprint(huntId, walletAddress);
  const records = readRecords()
    .filter((r) => r.huntId === huntId)
    .sort((a, b) => a.createdAt - b.createdAt);
  const i = records.findIndex((r) => r.walletFingerprint === fp);
  return i < 0 ? undefined : { localRank: i + 1, createdAt: records[i]!.createdAt };
}

/**
 * Enregistre un engagement mocké (5 KAS simulés).
 * Lève une erreur si ce wallet est déjà engagé dans la chasse.
 */
export async function mockCommit(
  huntId: string,
  walletAddress: string,
): Promise<MockCommitReceipt> {
  if (!walletAddress) throw new Error("Wallet non connecté.");
  if (hasMockCommitment(huntId, walletAddress)) {
    throw new Error("Tu es déjà engagé·e dans cette hunt.");
  }

  const secret = bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
  const commitment = bytesToHex(sha256(utf8ToBytes(`${huntId}|${secret}`)));
  const createdAt = Date.now();

  writeJson(RECORDS_KEY, [
    ...readRecords(),
    { huntId, walletFingerprint: walletFingerprint(huntId, walletAddress), commitment, createdAt },
  ]);

  // Le secret n'est pas conservé (règle privacy du prototype). Le vrai
  // wallet le gérera lui-même pour produire la preuve ZK.

  if (isBrowser()) window.dispatchEvent(new Event(CHANGE_EVENT));
  return { huntId, commitment, createdAt };
}

/** Nombre d'engagements : `baseCount` (données démo) + engagements locaux. */
export function getMockCommitCount(huntId: string, baseCount = 0): number {
  return baseCount + readRecords().filter((r) => r.huntId === huntId).length;
}

/** Abonnement aux changements (rafraîchit les hooks React, y compris entre onglets). */
export function onCommitmentsChange(listener: () => void): () => void {
  if (!isBrowser()) return () => {};
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

/** Réinitialise les engagements mockés (dev / tests). */
export function clearMockCommitments() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(RECORDS_KEY);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
