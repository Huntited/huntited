// Registre sur la chaîne, côté site (docs/registre-kaspa.md) :
// - format des messages, identique à src/lib/onchain/protocol.ts ;
// - publication par Kastle (0,2 KAS de test vers l'adresse du registre) ;
// - chasses envoyées mais pas encore vues par l'index (≈ 1 min).
import { sendToRegistry } from "./wallet";

/**
 * Adresse du registre : sans clé privée connue, dérivée de la phrase publique
 * « huntited:registry:v1 » (src/lib/onchain/addresses.test.ts, qui teste
 * cette même valeur).
 */
export const REGISTRY_ADDRESS =
  "kaspatest:qr2ck8qnt0rtj7spzd7am9tsmtd5j4l3tgtah3tzz89l9jvcfg5uvc33cl3yj";

/** Montant envoyé avec chaque message : 0,2 KAS, le minimum de Kastle. */
export const REGISTRY_FEE_SOMPI = 20_000_000;

export interface ChainHuntMessage {
  t: "hunt";
  id: string;
  title: string;
  description: string;
  location: string;
  country?: string;
  /** Date limite, en millisecondes. */
  deadline: number;
  threshold: number;
  deposit: number;
  progressVisibility: "visible" | "hidden";
  /** Clé publique de chat du créateur (src/lib/p2p-chat.ts). */
  chat?: string;
}

export interface ChainCommitMessage {
  t: "commit";
  hunt: string;
  threshold?: number;
  /** Clé publique de chat de la personne qui s'engage. */
  chat?: string;
  /** Engagement conditionnel : ne compte que si cette autre chasse s'est déclenchée. */
  after?: string;
}

/** Retrait d'un engagement (wallet), avant le déclenchement seulement. */
export interface ChainWithdrawMessage {
  t: "withdraw";
  hunt: string;
}

/** Version officielle du site (seule l'adresse de publication est prise en compte). */
export interface ChainReleaseMessage {
  t: "release";
  version: string;
  manifest: string;
  cid?: string;
}

/** Modération : masquer ou réafficher une chasse (seule la clé de publication compte). */
export type ChainModerationMessage =
  { t: "hide"; hunt: string; reason: string } | { t: "unhide"; hunt: string };

/** Pass de groupe : places inscrites, engagements signés par les places (par lot). */
export type ChainGroupMessage =
  | { t: "places"; hunt: string; keys: string[] }
  | {
      t: "gcommit";
      hunt: string;
      entries: { place: string; threshold?: number; chat?: string; sig: string }[];
    };

export type ChainMessage =
  | ChainHuntMessage
  | ChainCommitMessage
  | ChainWithdrawMessage
  | ChainReleaseMessage
  | ChainModerationMessage
  | ChainGroupMessage;

/** « HNT1 » + JSON, en hexadécimal (format attendu par Kastle). */
export function encodePayload(m: ChainMessage): string {
  return Array.from(new TextEncoder().encode(`HNT1${JSON.stringify(m)}`), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

/** Identifiant de chasse : 24 caractères hexadécimaux aléatoires. */
export function newHuntId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

/** Envoie le message par Kastle ; renvoie l'identifiant de la transaction. */
export function publish(m: ChainMessage): Promise<string> {
  return sendToRegistry(REGISTRY_ADDRESS, REGISTRY_FEE_SOMPI, encodePayload(m));
}

// --- Chasses envoyées, pas encore indexées ---------------------------------------

const PENDING_KEY = "huntited:chain-pending";
/** Au-delà, on considère que la transaction n'a pas abouti. */
export const PENDING_TTL_MS = 30 * 60_000;

type Pending = Record<string, { hunt: ChainHuntMessage; sentAt: number }>;

function readPending(): Pending {
  try {
    const v = JSON.parse(localStorage.getItem(PENDING_KEY) ?? "{}") as unknown;
    return typeof v === "object" && v !== null ? (v as Pending) : {};
  } catch {
    return {};
  }
}

function writePending(p: Pending) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(p));
  } catch {
    /* stockage indisponible : la chasse apparaîtra simplement après indexation */
  }
}

export function addPendingHunt(hunt: ChainHuntMessage, now = Date.now()): void {
  const all = readPending();
  for (const [id, p] of Object.entries(all)) if (now - p.sentAt > PENDING_TTL_MS) delete all[id];
  all[hunt.id] = { hunt, sentAt: now };
  writePending(all);
}

export function getPendingHunt(id: string, now = Date.now()): ChainHuntMessage | undefined {
  const p = readPending()[id];
  return p && now - p.sentAt <= PENDING_TTL_MS ? p.hunt : undefined;
}

export function forgetPendingHunt(id: string): void {
  const all = readPending();
  if (!(id in all)) return;
  delete all[id];
  writePending(all);
}
