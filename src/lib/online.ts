// Actions en ligne : pas de ville ni de pays. Le lieu vaut ONLINE_LOCATION
// (une valeur qui ne peut pas être une ville), sans pays : aucun changement
// de format côté serveur ni sur la chaîne.
import type { MessageKey } from "./i18n";

export const ONLINE_LOCATION = "@online";
/** Valeur du filtre « En ligne » sur l'accueil (à côté des pays). */
export const ONLINE_FILTER = "online";

export const isOnlineHunt = (h: { location: string }) => h.location === ONLINE_LOCATION;

/** Lieu affichable : « En ligne », ou la ville. */
export function placeLabel(h: { location: string }, t: (key: MessageKey) => string): string {
  return isOnlineHunt(h) ? t("hunt.online") : h.location;
}
