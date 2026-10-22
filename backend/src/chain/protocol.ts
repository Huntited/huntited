// Format des messages du registre Huntited sur Kaspa (voir docs/registre-kaspa.md).
//
// Chaque message est le « payload » d'une transaction envoyée vers l'adresse
// du registre : le préfixe « HNT1 » puis un JSON.
//
// Par défaut, une chasse et un engagement sont des transactions envoyées
// depuis le wallet de la personne (qui paiera le dépôt) : l'identité est
// l'adresse qui envoie. Conseil : une adresse dédiée à Huntited, alimentée
// directement depuis l'extérieur (voir docs/registre-kaspa.md).
//
// En réserve (Genesis.passRequired) : le pass, pour un anonymat complet —
// preuves Semaphore publiées par un relais, sans adresse personnelle.
//
// Cinq messages :
//   invite  : un membre crée une invitation (pass, quota mensuel)
//   pass    : une invitation est utilisée pour ajouter un pass au groupe
//   hunt    : une chasse est créée
//   commit  : un engagement, avec son seuil personnel
//   release : une version officielle du site (adresse de publication seulement)
import { createHash } from "node:crypto";

import { schnorr } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";
import { z } from "zod";

import { proofSchema, textToField } from "../services/semaphore.js";

export const PAYLOAD_PREFIX = "HNT1";

/** Règles fixées à la création du registre, identiques pour tous les index. */
export interface Genesis {
  /** Clés publiques des invitations de départ (amorçage). */
  invitationKeys: string[];
  minThreshold: number;
  minCautionKas: number;
  invitesPerMonth: number;
  /**
   * Pass exigé pour créer et s'engager (anonymat complet, via un relais).
   * Désactivé : n'importe quel wallet peut créer et rejoindre une chasse.
   */
  passRequired: boolean;
  /**
   * Adresses autorisées à ancrer une version du site (message « release »).
   * Vide : aucune version officielle.
   */
  releaseAddresses: string[];
}

export const DEFAULT_GENESIS: Omit<Genesis, "invitationKeys"> = {
  minThreshold: 7,
  minCautionKas: 30,
  invitesPerMonth: 3,
  passRequired: false,
  releaseAddresses: [],
};

export const INVITATION_TTL_MS = 7 * 24 * 3600 * 1000;
export const MAX_DEADLINE_MS = 366 * 24 * 3600 * 1000;
export const MAX_PERSONAL_THRESHOLD = 100_000;
/** Racines récentes acceptées (le groupe grandit entre la preuve et sa publication). */
export const ROOT_HISTORY = 100;

const hex = (len: number) => z.string().regex(new RegExp(`^[0-9a-f]{${len}}$`));
const field = z.string().regex(/^\d{1,80}$/);

/** Identifiant d'une chasse : 24 caractères hexadécimaux choisis par le créateur. */
export const huntIdSchema = hex(24);

export const inviteMessage = z.object({
  t: z.literal("invite"),
  /** Clé publique (x-only, 32 octets) de l'invitation. */
  key: hex(64),
  /** Emplacement du quota mensuel (1..invitesPerMonth). */
  slot: z.number().int().min(1).max(20),
  proof: proofSchema,
});

export const passMessage = z.object({
  t: z.literal("pass"),
  key: hex(64),
  /** Empreinte publique du nouveau pass (identity commitment). */
  commitment: field,
  /** Signature Schnorr de redeemDigest(commitment) par la clé d'invitation. */
  sig: hex(128),
});

export const huntMessage = z.object({
  t: z.literal("hunt"),
  id: huntIdSchema,
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(2000),
  location: z.string().trim().min(1).max(200),
  country: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .optional(),
  /** Date limite (ms depuis 1970). */
  deadline: z.number().int().positive(),
  threshold: z.number().int().max(100_000),
  /** Caution du créateur, en KAS entiers (simulée pour l'instant). */
  deposit: z.number().int().max(100_000),
  progressVisibility: z.enum(["visible", "hidden"]),
  /** Clé publique de chat du créateur (chat chiffré, docs/chat.md). */
  chat: hex(64).optional(),
  /** Pass (en réserve) : scope createScope(id), message huntDigest(contenu). */
  proof: proofSchema.optional(),
});

export const commitMessage = z.object({
  t: z.literal("commit"),
  hunt: huntIdSchema,
  /** Seuil personnel (≥ seuil de la chasse) ; absent = seuil de la chasse. */
  threshold: z.number().int().positive().optional(),
  /** Clé publique de chat de la personne qui s'engage. */
  chat: hex(64).optional(),
  /** Pass (en réserve) : scope huntScope(hunt), message = seuil personnel. */
  proof: proofSchema.optional(),
});

/**
 * Version officielle du site : son numéro, l'empreinte (sha256) de la liste
 * de ses fichiers (release.json) et, si connu, son identifiant IPFS.
 */
export const releaseMessage = z.object({
  t: z.literal("release"),
  version: z.string().regex(/^[\w.+-]{1,40}$/),
  manifest: hex(64),
  cid: z
    .string()
    .regex(/^b[a-z2-7]{20,120}$/)
    .optional(),
});

/** Raisons de masquage d'une chasse (conditions d'utilisation, « Usages interdits »). */
export const HIDE_REASONS = [
  "illegal",
  "violence",
  "harassment",
  "personal-data",
  "deception",
  "spam",
] as const;

/**
 * Modération (docs/moderation.md) : la clé de publication (huntited.kas)
 * masque ou réaffiche une chasse sur le site. La chasse reste sur la chaîne ;
 * le masquage, lui aussi public, est visible de tous.
 */
export const hideMessage = z.object({
  t: z.literal("hide"),
  hunt: huntIdSchema,
  reason: z.enum(HIDE_REASONS),
});

export const unhideMessage = z.object({
  t: z.literal("unhide"),
  hunt: huntIdSchema,
});

/**
 * Pass de groupe (docs/pass-groupe.md) : une association inscrit des clés de
 * places pour une chasse, puis inscrit par lots les engagements que les
 * membres ont signés avec ces clés. La chaîne voit l'association, jamais le
 * membre.
 */
export const MAX_PLACES_PER_MESSAGE = 100;
export const MAX_GROUP_COMMITS_PER_MESSAGE = 40;

export const placesMessage = z.object({
  t: z.literal("places"),
  hunt: huntIdSchema,
  /** Clés publiques des places (x seul, hex). */
  keys: z.array(hex(64)).min(1).max(MAX_PLACES_PER_MESSAGE),
});

export const groupCommitEntry = z.object({
  place: hex(64),
  threshold: z.number().int().positive().optional(),
  chat: hex(64).optional(),
  /** Signature de la place sur placeDigest(chasse, entrée). */
  sig: hex(128),
});

export const groupCommitMessage = z.object({
  t: z.literal("gcommit"),
  hunt: huntIdSchema,
  entries: z.array(groupCommitEntry).min(1).max(MAX_GROUP_COMMITS_PER_MESSAGE),
});

export const messageSchema = z.discriminatedUnion("t", [
  inviteMessage,
  passMessage,
  huntMessage,
  commitMessage,
  releaseMessage,
  hideMessage,
  unhideMessage,
  placesMessage,
  groupCommitMessage,
]);

export type InviteMessage = z.infer<typeof inviteMessage>;
export type PassMessage = z.infer<typeof passMessage>;
export type HuntMessage = z.infer<typeof huntMessage>;
export type CommitMessage = z.infer<typeof commitMessage>;
export type ReleaseMessage = z.infer<typeof releaseMessage>;
export type HideMessage = z.infer<typeof hideMessage>;
export type UnhideMessage = z.infer<typeof unhideMessage>;
export type HideReason = (typeof HIDE_REASONS)[number];
export type PlacesMessage = z.infer<typeof placesMessage>;
export type GroupCommitEntry = z.infer<typeof groupCommitEntry>;
export type GroupCommitMessage = z.infer<typeof groupCommitMessage>;
export type Message = z.infer<typeof messageSchema>;

// --- Encodage ------------------------------------------------------------------

export function encodeMessage(m: Message): Uint8Array {
  return new TextEncoder().encode(PAYLOAD_PREFIX + JSON.stringify(m));
}

/** Message lu sur la chaîne, ou null s'il n'est pas un message Huntited valide. */
export function decodeMessage(payload: Uint8Array): Message | null {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(payload);
  } catch {
    return null;
  }
  if (!text.startsWith(PAYLOAD_PREFIX)) return null;
  try {
    const parsed = messageSchema.safeParse(JSON.parse(text.slice(PAYLOAD_PREFIX.length)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

// --- Scopes et empreintes (identiques côté front) -------------------------------

const sha256Hex = (s: string) => createHash("sha256").update(s).digest("hex");

/** Empreinte (31 octets, tient dans le champ de la preuve) d'un texte. */
export const digestField = (s: string) => BigInt(`0x${sha256Hex(s).slice(0, 62)}`).toString();

export const createScope = (huntId: string) => `create:${huntId}`;
export const huntScope = (huntId: string) => `hunt:${huntId}`;
/** Scope d'une invitation : mois (UTC) et emplacement. */
export const inviteScope = (month: string, slot: number) => `invite:${month}:${slot}`;
export const monthOf = (ms: number) => new Date(ms).toISOString().slice(0, 7);

/** Contenu d'une chasse scellé dans la preuve du créateur (le relais ne peut rien changer). */
export function huntDigest(h: Omit<HuntMessage, "t" | "proof">): string {
  return digestField(
    JSON.stringify([
      h.id,
      h.title,
      h.description,
      h.location,
      h.country ?? "",
      h.deadline,
      h.threshold,
      h.deposit,
      h.progressVisibility,
    ]),
  );
}

/** Message de la preuve d'invitation : la clé publique créée. */
export const inviteDigest = (key: string) => digestField(`huntited:invite|${key}`);

/** Ce que signe la clé d'invitation : le pass qu'elle fait entrer (anti-vol en route). */
export const redeemDigest = (commitment: string) =>
  hexToBytes(sha256Hex(`huntited:redeem|${commitment}`));

/** Clé publique d'une invitation à partir de son code secret (32 octets hex). */
export const invitationKey = (code: string) => bytesToHex(schnorr.getPublicKey(hexToBytes(code)));

export const signRedeem = (code: string, commitment: string) =>
  bytesToHex(schnorr.sign(redeemDigest(commitment), hexToBytes(code)));

/** Ce que signe une place : la chasse, le seuil personnel et la clé de chat. */
export const placeDigest = (
  hunt: string,
  e: { threshold?: number | undefined; chat?: string | undefined },
) => sha256(utf8ToBytes(`huntited:place-commit|${hunt}|${e.threshold ?? ""}|${e.chat ?? ""}`));

export const signPlaceCommit = (
  placePriv: string,
  hunt: string,
  e: { threshold?: number | undefined; chat?: string | undefined },
) => bytesToHex(schnorr.sign(placeDigest(hunt, e), hexToBytes(placePriv)));

export function verifyPlaceCommit(hunt: string, e: GroupCommitEntry): boolean {
  try {
    return schnorr.verify(hexToBytes(e.sig), placeDigest(hunt, e), hexToBytes(e.place));
  } catch {
    return false;
  }
}

export function verifyRedeem(m: PassMessage): boolean {
  try {
    return schnorr.verify(hexToBytes(m.sig), redeemDigest(m.commitment), hexToBytes(m.key));
  } catch {
    return false;
  }
}

/** Scope attendu dans une preuve (encodage Semaphore). */
export const scopeField = (scope: string) => textToField(scope);
