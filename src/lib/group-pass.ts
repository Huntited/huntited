// Pass de groupe (docs/pass-groupe.md) : une association offre des places
// pour une chasse. Ses membres s'engagent sans wallet ni KAS ; l'association
// inscrit leurs engagements par lots. La chaîne voit l'association, jamais
// le membre.
//
// - L'association crée N clés de places et une clé de boîte de réception.
// - Chaque membre reçoit un lien : #/place/<chasse>/<clé de place>/<boîte>.
//   Le lien est un billet : qui l'a peut utiliser la place.
// - Le membre signe son engagement avec la clé de place et l'envoie, chiffré
//   pour la boîte de l'association, sur les relais Nostr.
// - L'association lit sa boîte et inscrit les engagements reçus en un message
//   `gcommit` (40 au plus par transaction).
import { schnorr } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

import {
  groupCommitEntry,
  signPlaceCommit,
  verifyPlaceCommit,
  type GroupCommitEntry,
} from "./onchain/protocol";
import {
  chatPublicKey,
  openFrom,
  sealFor,
  signEvent,
  verifyEvent,
  type NostrEvent,
} from "./p2p-chat";

/** Type d'événement Nostr des demandes d'engagement (membre → association). */
export const PLACE_REQUEST_KIND = 4243;
const STORAGE = "huntited:groups";
const MAX_PLACES = 500;

export interface Group {
  hunt: string;
  title: string;
  /** Clé privée de la boîte de réception (hex). */
  inbox: string;
  /** Clés privées des places (hex). */
  places: string[];
  createdAt: number;
}

const newKey = () => bytesToHex(schnorr.utils.randomSecretKey());

// --- Côté association : groupes gardés dans ce navigateur ---

export function groups(): Group[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE) ?? "[]") as unknown;
    return Array.isArray(raw)
      ? (raw as Group[]).filter((g) => g && typeof g.hunt === "string" && Array.isArray(g.places))
      : [];
  } catch {
    return [];
  }
}

function saveGroups(all: Group[]): void {
  localStorage.setItem(STORAGE, JSON.stringify(all));
}

/** Crée N places pour une chasse (ou en ajoute, si le groupe existe déjà). */
export function createGroup(hunt: string, title: string, count: number): Group {
  const n = Math.max(1, Math.min(MAX_PLACES, Math.floor(count)));
  const all = groups();
  const existing = all.find((g) => g.hunt === hunt);
  const group: Group = existing
    ? {
        ...existing,
        places: [...existing.places, ...Array.from({ length: n }, newKey)].slice(0, MAX_PLACES),
      }
    : {
        hunt,
        title,
        inbox: newKey(),
        places: Array.from({ length: n }, newKey),
        createdAt: Date.now(),
      };
  saveGroups([group, ...all.filter((g) => g.hunt !== hunt)]);
  return group;
}

/** Sauvegarde du groupe (à garder : sans elle, plus d'accès aux places). */
export const exportGroup = (g: Group) =>
  JSON.stringify({ format: "huntited-group-v1", ...g }, null, 2);

export function importGroup(text: string): Group | null {
  try {
    const g = JSON.parse(text) as Group & { format?: string };
    if (
      g.format !== "huntited-group-v1" ||
      typeof g.inbox !== "string" ||
      !Array.isArray(g.places)
    ) {
      return null;
    }
    const group: Group = {
      hunt: g.hunt,
      title: g.title,
      inbox: g.inbox,
      places: g.places,
      createdAt: g.createdAt,
    };
    saveGroups([group, ...groups().filter((x) => x.hunt !== g.hunt)]);
    return group;
  } catch {
    return null;
  }
}

export const placePublic = (priv: string) => chatPublicKey(priv);

/** Lien d'une place (adresse du site + route « # »). */
export function placeLink(base: string, g: Group, placePriv: string): string {
  return `${base}#/place/${g.hunt}/${placePriv}/${chatPublicKey(g.inbox)}`;
}

// --- Demandes d'engagement (membre → association), chiffrées ---

/** Étiquette commune aux demandes d'un groupe (ce que filtrent les relais). */
export const groupTopic = (inboxPub: string) =>
  bytesToHex(sha256(utf8ToBytes(`huntited:group:v1:${inboxPub}`)));

const context = (hunt: string) => `huntited-place-v1:${hunt}`;

/** Le membre signe son engagement et le chiffre pour la boîte de l'association. */
export async function sealPlaceRequest(
  hunt: string,
  placePriv: string,
  inboxPub: string,
  e: { threshold?: number; chat?: string },
  deadline: number,
): Promise<{ event: NostrEvent; entry: GroupCommitEntry }> {
  const entry: GroupCommitEntry = {
    place: chatPublicKey(placePriv),
    ...(e.threshold !== undefined ? { threshold: e.threshold } : {}),
    ...(e.chat ? { chat: e.chat } : {}),
    sig: signPlaceCommit(placePriv, hunt, e),
  };
  const content = await sealFor(
    placePriv,
    inboxPub,
    context(hunt),
    utf8ToBytes(JSON.stringify(entry)),
  );
  const event = signEvent(
    {
      created_at: Math.floor(Date.now() / 1000),
      kind: PLACE_REQUEST_KIND,
      tags: [
        ["h", groupTopic(inboxPub)],
        // Inutile après la date limite (NIP-40).
        ["expiration", String(Math.floor(deadline / 1000) + 86_400)],
      ],
      content,
    },
    placePriv,
  );
  return { event, entry };
}

/**
 * L'association lit une demande : null si elle ne vient pas d'une de ses
 * places, si elle est mal signée, ou si elle ne vise pas cette chasse.
 */
export async function openPlaceRequest(g: Group, e: NostrEvent): Promise<GroupCommitEntry | null> {
  if (e.kind !== PLACE_REQUEST_KIND || !verifyEvent(e)) return null;
  const mine = new Set(g.places.map(chatPublicKey));
  if (!mine.has(e.pubkey)) return null;
  try {
    const plain = await openFrom(g.inbox, e.pubkey, context(g.hunt), e.content);
    const parsed = groupCommitEntry.safeParse(JSON.parse(new TextDecoder().decode(plain)));
    if (!parsed.success || parsed.data.place !== e.pubkey) return null;
    return verifyPlaceCommit(g.hunt, parsed.data) ? parsed.data : null;
  } catch {
    return null;
  }
}

// --- Côté membre : sa place, gardée dans ce navigateur ---

const MY_PLACES = "huntited:my-places";

export function rememberPlaceRequest(hunt: string, place: string): void {
  try {
    const all = JSON.parse(localStorage.getItem(MY_PLACES) ?? "{}") as Record<string, unknown>;
    localStorage.setItem(
      MY_PLACES,
      JSON.stringify({ ...all, [hunt]: { place, sentAt: Date.now() } }),
    );
  } catch {
    /* rien à faire */
  }
}

export function myPlaceRequest(hunt: string): { place: string; sentAt: number } | null {
  try {
    const all = JSON.parse(localStorage.getItem(MY_PLACES) ?? "{}") as Record<
      string,
      { place: string; sentAt: number }
    >;
    return all[hunt] ?? null;
  } catch {
    return null;
  }
}
