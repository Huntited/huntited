/**
 * Registre local "adresse → chasses créées" (mock).
 *
 * Dans la version réelle, cette liste viendra du contrat HuntRegistry
 * on-chain, indexée par adresse de créateur. Ici, tout reste sur
 * l'appareil (localStorage), rien n'est transmis.
 *
 * Privacy-first : on ne stocke que des références (id, titre, lieu,
 * deadline, seuil), pas le contenu complet ni de données personnelles.
 */

const STORAGE_KEY = "huntited:user-hunts";

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
  const list = store[address] ?? [];
  if (list.some((h) => h.huntId === hunt.huntId)) return;
  list.push(hunt);
  store[address] = list;
  setStore(store);
}

/** Retourne les chasses créées par une adresse (les plus récentes en dernier). */
export function getUserHunts(address: string): UserHuntRef[] {
  return getStore()[address] ?? [];
}

/** Vide le registre (dev / tests uniquement). */
export function clearUserHunts() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
