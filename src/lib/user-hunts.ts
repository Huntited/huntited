/**
 * Registre local "adresse → chasses créées" (mock).
 *
 * Dans la version réelle, cette liste viendra du contrat HuntRegistry
 * on-chain, indexée par adresse de créateur. Ici, tout reste sur
 * l'appareil (localStorage), rien n'est transmis.
 *
 * Privacy-first : on ne stocke que des références (id, titre, lieu,
 * deadline, seuil), pas le contenu complet ni de données personnelles.
 * Le créateur est indexé par une empreinte pseudonyme, jamais par son
 * adresse brute.
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

const STORAGE_KEY = "huntited:user-hunts";

/** Empreinte pseudonyme du créateur : SHA-256("huntited:creator" | adresse). */
export function creatorFingerprint(address: string): string {
  return bytesToHex(sha256(utf8ToBytes(`huntited:creator|${address}`)));
}

/**
 * Migre une entrée de l'ancien format (indexée par adresse brute) vers
 * l'empreinte. Renvoie true si le registre a été modifié.
 */
function migrateLegacy(store: Record<string, UserHuntRef[]>, address: string, fp: string) {
  const legacy = store[address];
  if (!legacy) return false;
  const current = store[fp] ?? [];
  for (const h of legacy) {
    if (!current.some((c) => c.huntId === h.huntId)) current.push(h);
  }
  store[fp] = current;
  delete store[address];
  return true;
}

/** Référence minimale d'une chasse créée par l'utilisateur. */
export interface UserHuntRef {
  huntId: string;
  title: string;
  location: string;
  deadline: string;
  threshold: number;
}

/** Lit le registre (adresse → références de chasses). */
function getStore(): Record<string, UserHuntRef[]> {
  if (typeof window === "undefined") return {};
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, UserHuntRef[]>;
  } catch {
    return {};
  }
}

function setStore(store: Record<string, UserHuntRef[]>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

/**
 * Ajoute une chasse à l'historique d'un créateur.
 * Ignore les doublons (même huntId déjà enregistré).
 */
export function addUserHunt(address: string, hunt: UserHuntRef) {
  const store = getStore();
  const fp = creatorFingerprint(address);
  migrateLegacy(store, address, fp);
  const list = store[fp] ?? [];
  if (!list.some((h) => h.huntId === hunt.huntId)) list.push(hunt);
  store[fp] = list;
  setStore(store);
}

/** Retourne les chasses créées par une adresse (les plus récentes en dernier). */
export function getUserHunts(address: string): UserHuntRef[] {
  const store = getStore();
  const fp = creatorFingerprint(address);
  if (migrateLegacy(store, address, fp)) setStore(store);
  return store[fp] ?? [];
}

/** Vide le registre (dev / tests uniquement). */
export function clearUserHunts() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
