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

/** Chasses pour lesquelles ce navigateur a une clé (créées ou rejointes ici). */
export const chatKeyHunts = (): string[] =>
  Object.keys(readKeys()).filter((id) => /^[0-9a-f]{24}$/.test(id));

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

// --- Pseudo (un par chasse, jamais sur la chaîne, envoyé chiffré) ---

const NAMES_STORAGE = "huntited:chat-names";
const ANIMALS = {
  fr: [
    "Renard",
    "Hibou",
    "Castor",
    "Lynx",
    "Blaireau",
    "Héron",
    "Loup",
    "Faucon",
    "Écureuil",
    "Hérisson",
    "Corbeau",
    "Ours",
    "Chamois",
    "Martin-pêcheur",
  ],
  en: [
    "Fox",
    "Owl",
    "Beaver",
    "Lynx",
    "Badger",
    "Heron",
    "Wolf",
    "Falcon",
    "Squirrel",
    "Hedgehog",
    "Raven",
    "Bear",
    "Chamois",
    "Kingfisher",
  ],
};
const COLORS = {
  fr: ["bleu", "vert", "gris", "roux", "doré", "pourpre", "orange", "ocre", "argenté", "cuivré"],
  en: ["Blue", "Green", "Grey", "Red", "Golden", "Purple", "Orange", "Ochre", "Silver", "Copper"],
};

/** Pseudo au hasard, pour ne pas inciter à donner son vrai nom. */
export function randomName(locale: "fr" | "en"): string {
  const pick = <T>(l: T[]) => l[crypto.getRandomValues(new Uint32Array(1))[0]! % l.length]!;
  const animal = pick(ANIMALS[locale]);
  const color = pick(COLORS[locale]);
  return locale === "fr" ? `${animal} ${color}` : `${color} ${animal}`;
}

function readNames(): Record<string, string> {
  try {
    const raw = JSON.parse(localStorage.getItem(NAMES_STORAGE) ?? "{}") as unknown;
    return raw && typeof raw === "object" ? (raw as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** Ton pseudo dans le chat de cette chasse (créé au hasard la première fois). */
export function getChatName(huntId: string, locale: "fr" | "en"): string {
  const existing = cleanName(readNames()[huntId]);
  if (existing) return existing;
  return setChatName(huntId, randomName(locale));
}

export function setChatName(huntId: string, name: string): string {
  const clean = cleanName(name) ?? randomName("fr");
  try {
    localStorage.setItem(NAMES_STORAGE, JSON.stringify({ ...readNames(), [huntId]: clean }));
  } catch {
    /* pseudo valable pour cette visite */
  }
  return clean;
}

/** Marque fixe d'un membre (tirée de sa clé) : un pseudo ne peut pas en imiter un autre. */
export const memberTag = (pub: string) => `#${pub.slice(0, 4).toUpperCase()}`;

/** Oublie les clés de chat de ce navigateur (page « Tes données »). */
export function forgetChatKeys(): void {
  try {
    localStorage.removeItem(KEYS_STORAGE);
    localStorage.removeItem(NAMES_STORAGE);
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
function sharedKey(priv: string, otherPub: string, info: string): Uint8Array {
  const point = secp256k1.getSharedSecret(hexToBytes(priv), hexToBytes(`02${otherPub}`));
  return hkdf(sha256, point.slice(1, 33), undefined, utf8ToBytes(info), 32);
}

function pairKey(priv: string, otherPub: string, huntId: string): Uint8Array {
  return sharedKey(priv, otherPub, `huntited-chat-v1:${huntId}`);
}

/** Chiffre pour une autre clé (secret partagé, propre au contexte) ; base64. */
export async function sealFor(
  priv: string,
  otherPub: string,
  context: string,
  data: Uint8Array,
): Promise<string> {
  return b64(await aesEncrypt(sharedKey(priv, otherPub, context), data));
}

/** Déchiffre ce que `otherPub` a chiffré pour `priv` dans ce contexte. */
export async function openFrom(
  priv: string,
  otherPub: string,
  context: string,
  sealed: string,
): Promise<Uint8Array> {
  return aesDecrypt(sharedKey(priv, otherPub, context), unb64(sealed));
}

/** Signe un événement Nostr avec une clé (identifiant calculé). */
export function signEvent(
  unsigned: Omit<NostrEvent, "id" | "sig" | "pubkey">,
  priv: string,
): NostrEvent {
  const e = { ...unsigned, pubkey: chatPublicKey(priv) };
  const id = eventId(e);
  return { ...e, id, sig: bytesToHex(schnorr.sign(hexToBytes(id), hexToBytes(priv))) };
}

const slot = (pub: string) => pub.slice(0, 16);

export interface ChatMessage {
  id: string;
  /** Clé publique de l'auteur (membre de la chasse). */
  author: string;
  text: string;
  /** Date d'envoi (horloge de l'auteur), en millisecondes. */
  at: number;
  /** Pseudo choisi par l'auteur pour cette chasse (chiffré, comme le texte). */
  name?: string;
  /** Pseudo bitchat partagé avec les membres (plan B sans réseau, chiffré). */
  bitchat?: string;
}

const MAX_NAME = 30;
/** Caractères de contrôle et de mise en forme invisibles (sens d’écriture…), retirés des pseudos. */
const INVISIBLE = new RegExp(
  `[${[
    [0x00, 0x1f],
    [0x7f, 0x9f],
    [0x200b, 0x200f],
    [0x202a, 0x202e],
  ]
    .map(([a, b]) => `${String.fromCharCode(a!)}-${String.fromCharCode(b!)}`)
    .join("")}]`,
  "g",
);
/** Pseudo propre : une ligne, sans caractères de contrôle, 30 caractères au plus. */
export function cleanName(name: unknown): string | undefined {
  if (typeof name !== "string") return undefined;
  const clean = name.replace(INVISIBLE, "").trim();
  return clean ? clean.slice(0, MAX_NAME) : undefined;
}

/** Message chiffré pour tous les membres, signé par la clé de chat de l'auteur. */
export async function sealMessage(
  huntId: string,
  priv: string,
  members: string[],
  text: string,
  deadline: number,
  { now = Date.now(), name, bitchat }: { now?: number; name?: string; bitchat?: string } = {},
): Promise<NostrEvent> {
  const clean = text.trim().slice(0, MAX_TEXT);
  if (!clean) throw new Error("empty_message");
  const pubkey = chatPublicKey(priv);
  const contentKey = crypto.getRandomValues(new Uint8Array(32));
  const pseudo = cleanName(name);
  const mesh = cleanName(bitchat);
  const body = await aesEncrypt(
    contentKey,
    utf8ToBytes(
      JSON.stringify({
        text: clean,
        at: now,
        ...(pseudo ? { name: pseudo } : {}),
        ...(mesh ? { bitchat: mesh } : {}),
      }),
    ),
  );
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
    const { text, at, name, bitchat } = JSON.parse(
      new TextDecoder().decode(await aesDecrypt(contentKey, unb64(body))),
    ) as {
      text: unknown;
      at: unknown;
      name: unknown;
      bitchat: unknown;
    };
    if (typeof text !== "string" || typeof at !== "number") return null;
    const pseudo = cleanName(name);
    const mesh = cleanName(bitchat);
    return {
      id: e.id,
      author: e.pubkey,
      text: text.slice(0, MAX_TEXT),
      at,
      ...(pseudo ? { name: pseudo } : {}),
      ...(mesh ? { bitchat: mesh } : {}),
    };
  } catch {
    return null;
  }
}
