// Chat chiffré d'une chasse, sans serveur Huntited (docs/chat.md).
//
// - Chaque membre (créateur, personnes engagées) a une clé de chat par
//   chasse, créée dans son navigateur. Sa partie publique est inscrite sur la
//   chaîne avec la création ou l'engagement : la liste des membres se lit sur
//   la chaîne, personne ne peut s'y ajouter.
// - Un message est chiffré une fois (AES-GCM, clé aléatoire), et cette clé est
//   chiffrée pour chaque membre avec un secret partagé (ECDH secp256k1) : seuls
//   les membres lisent, sans échange préalable.
// - Le message est un événement Nostr signé par la clé de chat de son auteur :
//   un message qui ne vient pas d'un membre est ignoré.
import { schnorr, secp256k1 } from "@noble/curves/secp256k1.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";

/** Type d'événement Nostr des messages de chat Huntited (« régulier » : gardé par les relais). */
export const CHAT_KIND = 4242;
/** Le chat reste ouvert 24 h après la date limite (comme le salon Matrix). */
export const CHAT_TTL_AFTER_DEADLINE_MS = 24 * 60 * 60 * 1000;
const MAX_TEXT = 2000;

const KEYS_STORAGE = "huntited:chat-keys";

// --- Clés de chat (une par chasse, dans ce navigateur) ---

function readKeys(): Record<string, string> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEYS_STORAGE) ?? "{}") as unknown;
    return raw && typeof raw === "object" ? (raw as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** Clé publique (x seul, hex) d'une clé privée de chat. */
export const chatPublicKey = (priv: string) => bytesToHex(schnorr.getPublicKey(hexToBytes(priv)));

/** Clé privée de chat de ce navigateur pour une chasse, si elle existe. */
export function getChatKey(huntId: string): string | null {
  const k = readKeys()[huntId];
  return typeof k === "string" && /^[0-9a-f]{64}$/.test(k) ? k : null;
}

/**
 * Clé publique de chat à inscrire sur la chaîne pour cette chasse (créée la
 * première fois). Sans stockage, renvoie undefined : on s'engage sans chat.
 */
export function ensureChatKey(huntId: string): string | undefined {
  const existing = getChatKey(huntId);
  if (existing) return chatPublicKey(existing);
  const priv = bytesToHex(schnorr.utils.randomSecretKey());
  try {
    localStorage.setItem(KEYS_STORAGE, JSON.stringify({ ...readKeys(), [huntId]: priv }));
  } catch {
    return undefined;
  }
  return getChatKey(huntId) ? chatPublicKey(priv) : undefined;
}

/** Oublie les clés de chat de ce navigateur (page « Tes données »). */
export function forgetChatKeys(): void {
  try {
    localStorage.removeItem(KEYS_STORAGE);
  } catch {
    /* rien à faire */
  }
}

// --- Événements Nostr (NIP-01) ---

export interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

/** Étiquette commune aux messages d'une chasse (ce que filtrent les relais). */
export const chatTopic = (huntId: string) =>
  bytesToHex(sha256(utf8ToBytes(`huntited:chat:v1:${huntId}`)));

const eventId = (e: Omit<NostrEvent, "id" | "sig">) =>
  bytesToHex(
    sha256(utf8ToBytes(JSON.stringify([0, e.pubkey, e.created_at, e.kind, e.tags, e.content]))),
  );

export function verifyEvent(e: NostrEvent): boolean {
  try {
    return (
      eventId(e) === e.id &&
      schnorr.verify(hexToBytes(e.sig), hexToBytes(e.id), hexToBytes(e.pubkey))
    );
  } catch {
    return false;
  }
}

// --- Chiffrement ---

const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const buf = (b: Uint8Array) => b.slice().buffer;

async function aesEncrypt(key: Uint8Array, plain: Uint8Array): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const k = await crypto.subtle.importKey("raw", buf(key), "AES-GCM", false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, k, buf(plain)));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv);
  out.set(ct, 12);
  return out;
}

async function aesDecrypt(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", buf(key), "AES-GCM", false, ["decrypt"]);
  return new Uint8Array(
    await crypto.subtle.decrypt({ name: "AES-GCM", iv: data.slice(0, 12) }, k, buf(data.slice(12))),
  );
}

/** Secret partagé entre deux membres (même valeur des deux côtés), propre à la chasse. */
function pairKey(priv: string, otherPub: string, huntId: string): Uint8Array {
  const point = secp256k1.getSharedSecret(hexToBytes(priv), hexToBytes(`02${otherPub}`));
  return hkdf(sha256, point.slice(1, 33), undefined, utf8ToBytes(`huntited-chat-v1:${huntId}`), 32);
}

const slot = (pub: string) => pub.slice(0, 16);

export interface ChatMessage {
  id: string;
  /** Clé publique de l'auteur (membre de la chasse). */
  author: string;
  text: string;
  /** Date d'envoi (horloge de l'auteur), en millisecondes. */
  at: number;
}

/** Message chiffré pour tous les membres, signé par la clé de chat de l'auteur. */
export async function sealMessage(
  huntId: string,
  priv: string,
  members: string[],
  text: string,
  deadline: number,
  now = Date.now(),
): Promise<NostrEvent> {
  const clean = text.trim().slice(0, MAX_TEXT);
  if (!clean) throw new Error("empty_message");
  const pubkey = chatPublicKey(priv);
  const contentKey = crypto.getRandomValues(new Uint8Array(32));
  const body = await aesEncrypt(contentKey, utf8ToBytes(JSON.stringify({ text: clean, at: now })));
  const keys: Record<string, string> = {};
  for (const m of new Set([...members, pubkey])) {
    let pair: Uint8Array;
    try {
      pair = pairKey(priv, m, huntId);
    } catch {
      continue; // clé inscrite sur la chaîne mais invalide : ce membre ne pourra pas lire
    }
    keys[slot(m)] = b64(await aesEncrypt(pair, contentKey));
  }
  const unsigned = {
    pubkey,
    created_at: Math.floor(now / 1000),
    kind: CHAT_KIND,
    tags: [
      ["h", chatTopic(huntId)],
      // Les relais qui le respectent effacent le message à la fermeture du chat (NIP-40).
      ["expiration", String(Math.floor((deadline + CHAT_TTL_AFTER_DEADLINE_MS) / 1000))],
    ],
    content: JSON.stringify({ v: 1, body: b64(body), keys }),
  };
  const id = eventId(unsigned);
  return { ...unsigned, id, sig: bytesToHex(schnorr.sign(hexToBytes(id), hexToBytes(priv))) };
}

/**
 * Lit un message : null s'il ne vient pas d'un membre, s'il est mal signé,
 * ou s'il n'a pas été chiffré pour cette clé.
 */
export async function openMessage(
  huntId: string,
  priv: string,
  members: string[],
  e: NostrEvent,
): Promise<ChatMessage | null> {
  if (e.kind !== CHAT_KIND || !members.includes(e.pubkey) || !verifyEvent(e)) return null;
  if (!e.tags.some((t) => t[0] === "h" && t[1] === chatTopic(huntId))) return null;
  try {
    const { v, body, keys } = JSON.parse(e.content) as {
      v: number;
      body: string;
      keys: Record<string, string>;
    };
    const wrapped = keys[slot(chatPublicKey(priv))];
    if (v !== 1 || !wrapped) return null;
    const contentKey = await aesDecrypt(pairKey(priv, e.pubkey, huntId), unb64(wrapped));
    const { text, at } = JSON.parse(
      new TextDecoder().decode(await aesDecrypt(contentKey, unb64(body))),
    ) as {
      text: unknown;
      at: unknown;
    };
    if (typeof text !== "string" || typeof at !== "number") return null;
    return { id: e.id, author: e.pubkey, text: text.slice(0, MAX_TEXT), at };
  } catch {
    return null;
  }
}
