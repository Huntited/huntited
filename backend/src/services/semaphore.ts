// Vérification des preuves Semaphore (« je suis dans le groupe des pass, et
// voici mon code pour ce scope »), sans savoir qui a produit la preuve.
// Voir docs/anti-bots.md.
import { verifyProof } from "@semaphore-protocol/proof";
import { z } from "zod";

/** Profondeur fixe des preuves : cache la taille réelle du groupe (≤ 2^20 membres). */
export const PROOF_DEPTH = 20;

const field = z.string().regex(/^\d{1,80}$/);

/** Forme d'une preuve envoyée par le front (sérialisée telle que générée). */
export const proofSchema = z.object({
  merkleTreeDepth: z.literal(PROOF_DEPTH),
  merkleTreeRoot: field,
  nullifier: field,
  message: field,
  scope: field,
  points: z.array(field).length(8),
});

export type ProofInput = z.infer<typeof proofSchema>;

/**
 * Encodage d'un texte court en élément de champ, identique à celui de la
 * bibliothèque Semaphore côté front (bytes32 UTF-8 complété par des zéros).
 */
export function textToField(text: string): string {
  const bytes = Buffer.from(text, "utf8");
  if (bytes.length > 31) throw new Error("scope trop long");
  const padded = Buffer.concat([bytes, Buffer.alloc(32 - bytes.length)]);
  return BigInt(`0x${padded.toString("hex")}`).toString();
}

/** Scope d'un engagement dans une chasse. */
export const huntScope = (huntId: string) => `hunt:${huntId}`;

/** Scope d'une invitation : mois courant (UTC) et numéro d'emplacement (1..N). */
export const inviteScope = (now: number, slot: number) =>
  `invite:${new Date(now).toISOString().slice(0, 7)}:${slot}`;

/**
 * Vérifie une preuve : racine de groupe connue, scope et message attendus,
 * puis validité cryptographique.
 */
export async function checkProof(
  proof: ProofInput,
  expected: { scope: string; message: string | number; roots: ReadonlySet<string> },
): Promise<boolean> {
  if (!expected.roots.has(proof.merkleTreeRoot)) return false;
  if (proof.scope !== textToField(expected.scope)) return false;
  if (proof.message !== BigInt(expected.message).toString()) return false;
  try {
    return await verifyProof(proof as Parameters<typeof verifyProof>[0]);
  } catch {
    return false;
  }
}
