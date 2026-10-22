// Format des messages du registre, côté navigateur.
// ⚠️ Copie conforme de backend/src/chain/protocol.ts (sans dépendance à Node) :
// un test compare les deux versions sur les mêmes transactions
// (src/lib/onchain/conformance.test.ts). Toute règle changée ici doit l'être
// là-bas, et inversement.
import { schnorr } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";
import { z } from "zod";

export const PAYLOAD_PREFIX = "HNT1";

/** Règles fixées à la création du registre, identiques pour tous les index. */
export interface Genesis {
  invitationKeys: string[];
  minThreshold: number;
  minCautionKas: number;
  invitesPerMonth: number;
  passRequired: boolean;
  /** Adresses autorisées à ancrer une version du site (message « release »). */
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
export const ROOT_HISTORY = 100;
/** Profondeur fixe des preuves de pass. */
export const PROOF_DEPTH = 20;

const hex = (len: number) => z.string().regex(new RegExp(`^[0-9a-f]{${len}}$`));
const field = z.string().regex(/^\d{1,80}$/);

export const proofSchema = z.object({
  merkleTreeDepth: z.literal(PROOF_DEPTH),
  merkleTreeRoot: field,
  nullifier: field,
  message: field,
  scope: field,
  points: z.array(field).length(8),
});
export type ProofInput = z.infer<typeof proofSchema>;

export const huntIdSchema = hex(24);

export const inviteMessage = z.object({
  t: z.literal("invite"),
  key: hex(64),
  slot: z.number().int().min(1).max(20),
  proof: proofSchema,
});

export const passMessage = z.object({
  t: z.literal("pass"),
  key: hex(64),
  commitment: field,
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
  deadline: z.number().int().positive(),
  threshold: z.number().int().max(100_000),
  deposit: z.number().int().max(100_000),
  progressVisibility: z.enum(["visible", "hidden"]),
  /** Clé publique de chat du créateur (chat chiffré, docs/chat.md). */
  chat: hex(64).optional(),
  proof: proofSchema.optional(),
});

export const commitMessage = z.object({
  t: z.literal("commit"),
  hunt: huntIdSchema,
  threshold: z.number().int().positive().optional(),
  /** Clé publique de chat de la personne qui s'engage. */
  chat: hex(64).optional(),
  proof: proofSchema.optional(),
});

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

export const messageSchema = z.discriminatedUnion("t", [
  inviteMessage,
  passMessage,
  huntMessage,
  commitMessage,
  releaseMessage,
  hideMessage,
  unhideMessage,
]);

export type InviteMessage = z.infer<typeof inviteMessage>;
export type PassMessage = z.infer<typeof passMessage>;
export type HuntMessage = z.infer<typeof huntMessage>;
export type CommitMessage = z.infer<typeof commitMessage>;
export type ReleaseMessage = z.infer<typeof releaseMessage>;
export type HideMessage = z.infer<typeof hideMessage>;
export type UnhideMessage = z.infer<typeof unhideMessage>;
export type HideReason = (typeof HIDE_REASONS)[number];
export type Message = z.infer<typeof messageSchema>;

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

const sha256Hex = (s: string) => bytesToHex(sha256(utf8ToBytes(s)));

export const digestField = (s: string) => BigInt(`0x${sha256Hex(s).slice(0, 62)}`).toString();

export const createScope = (huntId: string) => `create:${huntId}`;
export const huntScope = (huntId: string) => `hunt:${huntId}`;
export const inviteScope = (month: string, slot: number) => `invite:${month}:${slot}`;
export const monthOf = (ms: number) => new Date(ms).toISOString().slice(0, 7);

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

export const inviteDigest = (key: string) => digestField(`huntited:invite|${key}`);

export const redeemDigest = (commitment: string) =>
  hexToBytes(sha256Hex(`huntited:redeem|${commitment}`));

export function verifyRedeem(m: PassMessage): boolean {
  try {
    return schnorr.verify(hexToBytes(m.sig), redeemDigest(m.commitment), hexToBytes(m.key));
  } catch {
    return false;
  }
}

/** Texte court → élément de champ (bytes32 UTF-8 complété de zéros), comme Semaphore. */
export function scopeField(text: string): string {
  const bytes = new TextEncoder().encode(text);
  if (bytes.length > 31) throw new Error("scope trop long");
  const padded = new Uint8Array(32);
  padded.set(bytes);
  return BigInt(`0x${bytesToHex(padded)}`).toString();
}
