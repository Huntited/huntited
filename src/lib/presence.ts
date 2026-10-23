// Compteur de présence (docs/presence.md) : le jour J, l'app Huntited Chat
// compte les membres de la chasse autour de soi, par Bluetooth, sans dire qui.
//
// - Une clé commune aux membres circule dans le salon, dans un message chiffré
//   pour eux seuls. Le créateur y fixe aussi le seuil sur place.
// - Avec cette clé, l'app envoie régulièrement un signal « je suis là »
//   chiffré, qui change à chaque fois : un inconnu ne peut ni le lire ni
//   suivre quelqu'un. Les autres membres le reconnaissent et comptent les
//   signaux distincts reçus ces dernières minutes.
// - Chaque membre a un identifiant de présence tiré de sa clé de chat : il
//   compte une fois, et les autres membres ne savent pas qui c'est.
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";

import { readBy, type ChatMessage, type Presence } from "./p2p-chat";

export const newPresenceKey = () => bytesToHex(crypto.getRandomValues(new Uint8Array(32)));

/** Identifiant de présence d'un membre : stable pour la chasse, sans lien visible avec sa clé. */
export const presenceId = (key: string, priv: string) =>
  bytesToHex(hmac(sha256, hexToBytes(key), utf8ToBytes(`huntited-presence-id|${priv}`)));

export interface PresenceState extends Presence {
  /** Message qui fait foi (son auteur, ses lecteurs). */
  from: ChatMessage;
}

/**
 * Clé et seuil en vigueur : le dernier message du créateur s'il en a envoyé
 * un, sinon le plus ancien (tous les membres retombent sur la même clé).
 */
export function presenceState(
  messages: ChatMessage[],
  creator: string | undefined,
): PresenceState | null {
  const withKey = messages
    .filter((m) => m.presence)
    .sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
  const fromCreator = withKey.filter((m) => m.author === creator).at(-1);
  const from = fromCreator ?? withKey[0];
  return from?.presence ? { ...from.presence, from } : null;
}

/**
 * Membres arrivés après l'envoi de la clé : elle doit leur être renvoyée.
 * Seul l'auteur du message en vigueur s'en charge (pas de renvois en double).
 */
export function presenceMissing(
  state: PresenceState,
  messages: ChatMessage[],
  members: string[],
  me: string,
): string[] {
  if (state.from.author !== me) return [];
  const carriers = messages.filter((m) => m.presence?.key === state.key);
  return members.filter((p) => !carriers.some((m) => readBy(m, p)));
}

interface PresenceApp {
  presenceStart?: (
    hunt: string,
    title: string,
    key: string,
    id: string,
    onsite: number,
    until: number,
  ) => boolean;
  presenceCount?: (hunt: string) => number;
}

function app(): PresenceApp | null {
  if (typeof window === "undefined") return null;
  const a = (window as unknown as { HuntitedApp?: PresenceApp }).HuntitedApp;
  return a && typeof a.presenceStart === "function" ? a : null;
}

/** L'app sait compter la présence (Huntited Chat 0.4 et plus). */
export const presenceSupported = () => app() !== null;

/** Demande à l'app d'envoyer le signal et de compter, jusqu'à `until` (ms). */
export function startPresence(
  hunt: string,
  title: string,
  state: Presence,
  priv: string,
  until: number,
): boolean {
  try {
    return (
      app()?.presenceStart?.(
        hunt,
        title,
        state.key,
        presenceId(state.key, priv),
        state.onsite ?? 0,
        Math.floor(until / 1000),
      ) === true
    );
  } catch {
    return false;
  }
}

/** Membres de la chasse autour de soi (soi compris) ; null hors de l'app. */
export function presenceCount(hunt: string): number | null {
  try {
    const n = app()?.presenceCount?.(hunt);
    return typeof n === "number" && n >= 0 ? n : null;
  } catch {
    return null;
  }
}
