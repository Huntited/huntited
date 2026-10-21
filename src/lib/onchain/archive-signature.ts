// Signature des archives du registre (docs/archives.md).
//
// L'archive en ligne garde des transactions que l'API publique a oubliées :
// on ne peut plus les revérifier sur la chaîne. Elle est donc signée par une
// clé d'archivage dont la clé publique est dans le code du site (lui-même
// ancré sur Kaspa). Prendre le compte qui héberge l'archive ne suffit plus à
// y glisser de fausses chasses ou une fausse « version officielle ».
import { schnorr } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";

/** Clé publique d'archivage officielle (la clé privée est un secret du job d'archive). */
export const OFFICIAL_ARCHIVE_SIGNER =
  "30a892b014b3ba518aa3dd825ffdaa48329bd516886fcf13e4e369cbf1882851";

interface RawEntry {
  txId: unknown;
  score: unknown;
  time: unknown;
  sender: unknown;
  payload: unknown;
}

/** Empreinte des entrées, dans l'ordre du fichier (même calcul pour signer et vérifier). */
export function archiveDigest(entries: RawEntry[]): Uint8Array {
  return sha256(
    utf8ToBytes(
      JSON.stringify([
        "huntited-registry-archive-v1",
        entries.map((e) => [e.txId, e.score, e.time, e.sender, e.payload]),
      ]),
    ),
  );
}

export function signArchive(entries: RawEntry[], privHex: string): { signer: string; sig: string } {
  const priv = hexToBytes(privHex);
  return {
    signer: bytesToHex(schnorr.getPublicKey(priv)),
    sig: bytesToHex(schnorr.sign(archiveDigest(entries), priv)),
  };
}

/** L'archive est-elle signée par l'une des clés autorisées ? */
export function archiveSignedBy(data: unknown, signers: string[]): boolean {
  if (!data || typeof data !== "object") return false;
  const { entries, signer, sig } = data as Record<string, unknown>;
  if (!Array.isArray(entries) || typeof signer !== "string" || typeof sig !== "string")
    return false;
  if (!signers.includes(signer)) return false;
  try {
    return schnorr.verify(
      hexToBytes(sig),
      archiveDigest(entries as RawEntry[]),
      hexToBytes(signer),
    );
  } catch {
    return false;
  }
}
