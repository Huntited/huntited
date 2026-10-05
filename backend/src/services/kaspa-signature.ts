// Vérification des signatures de message Kaspa (format utilisé par Kastle).
//
// Référence : rusty-kaspa
//   - wallet/core/src/message.rs : empreinte Blake2b-256 avec la clé
//     "PersonalMessageSigningHash", puis Schnorr BIP-340, clé publique x-only ;
//   - crypto/addresses/src/bech32.rs : encodage des adresses (charset,
//     polymod 40 bits, somme de contrôle sur 8 caractères).
// Validé par les vecteurs de test de ces deux fichiers (kaspa-signature.test.ts).
// Aucun log : ni adresse, ni message, ni signature.
import { schnorr } from "@noble/curves/secp256k1.js";
import { blake2b } from "@noble/hashes/blake2.js";
import { hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";

const CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
const GENERATORS = [0x98f2bc8e61n, 0x79b76d99e2n, 0xf33e5fb3c4n, 0xae2eabe2a8n, 0x1e4f43e470n];
const PERSONAL_MESSAGE_KEY = utf8ToBytes("PersonalMessageSigningHash");

/** Version d'adresse « clé publique Schnorr » (32 octets x-only). */
export const ADDRESS_VERSION_PUBKEY = 0;

function polymod(values: Iterable<number>): bigint {
  let c = 1n;
  for (const d of values) {
    const c0 = c >> 35n;
    c = ((c & 0x07ffffffffn) << 5n) ^ BigInt(d);
    GENERATORS.forEach((g, i) => {
      if ((c0 >> BigInt(i)) & 1n) c ^= g;
    });
  }
  return c ^ 1n;
}

function checksum(payload5: number[], prefix: string): bigint {
  const prefix5 = [...prefix].map((ch) => ch.charCodeAt(0) & 0x1f);
  return polymod([...prefix5, 0, ...payload5, 0, 0, 0, 0, 0, 0, 0, 0]);
}

function conv8to5(bytes: Uint8Array): number[] {
  const out: number[] = [];
  let buff = 0;
  let bits = 0;
  for (const b of bytes) {
    buff = ((buff << 8) | b) & 0xffff;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out.push((buff >> bits) & 0x1f);
    }
  }
  if (bits > 0) out.push((buff << (5 - bits)) & 0x1f);
  return out;
}

function conv5to8(values: number[]): Uint8Array {
  const out: number[] = [];
  let buff = 0;
  let bits = 0;
  for (const v of values) {
    buff = ((buff << 5) | v) & 0xffff;
    bits += 5;
    while (bits >= 8) {
      bits -= 8;
      out.push((buff >> bits) & 0xff);
    }
  }
  return Uint8Array.from(out);
}

export interface DecodedAddress {
  prefix: string;
  version: number;
  payload: Uint8Array;
}

/** Encode une adresse Kaspa (utilisé par les tests et pour vérifier le décodage). */
export function encodeKaspaAddress(prefix: string, version: number, payload: Uint8Array): string {
  const payload5 = conv8to5(Uint8Array.from([version, ...payload]));
  const sum = checksum(payload5, prefix);
  const sum5 = Array.from({ length: 8 }, (_, i) => Number((sum >> BigInt(5 * (7 - i))) & 0x1fn));
  return `${prefix}:${[...payload5, ...sum5].map((v) => CHARSET[v]).join("")}`;
}

/** Décode une adresse Kaspa et vérifie sa somme de contrôle. Lève en cas d'erreur. */
export function decodeKaspaAddress(address: string): DecodedAddress {
  const sep = address.lastIndexOf(":");
  if (sep <= 0 || address !== address.toLowerCase()) throw new Error("Adresse invalide.");
  const prefix = address.slice(0, sep);
  const values = [...address.slice(sep + 1)].map((ch) => CHARSET.indexOf(ch));
  if (values.length <= 8 || values.some((v) => v < 0)) throw new Error("Adresse invalide.");

  const payload5 = values.slice(0, -8);
  const expected = values.slice(-8).reduce((acc, v) => (acc << 5n) | BigInt(v), 0n);
  if (checksum(payload5, prefix) !== expected) throw new Error("Adresse invalide.");

  const bytes = conv5to8(payload5);
  if (bytes.length < 1) throw new Error("Adresse invalide.");
  return { prefix, version: bytes[0]!, payload: bytes.slice(1) };
}

/** Empreinte d'un message personnel Kaspa (Blake2b-256 à clé). */
export function personalMessageHash(message: string): Uint8Array {
  return blake2b(utf8ToBytes(message), { dkLen: 32, key: PERSONAL_MESSAGE_KEY });
}

/**
 * true si `signatureHex` est une signature valide de `message` par la clé
 * contenue dans `address` (adresse Schnorr, préfixe attendu `expectedPrefix`).
 * Ne lève jamais : toute entrée invalide renvoie false.
 */
export function verifyKaspaMessage(input: {
  message: string;
  signatureHex: string;
  address: string;
  expectedPrefix: string;
}): boolean {
  try {
    if (!/^[0-9a-f]{128}$/i.test(input.signatureHex)) return false;
    const decoded = decodeKaspaAddress(input.address);
    if (decoded.prefix !== input.expectedPrefix) return false;
    if (decoded.version !== ADDRESS_VERSION_PUBKEY || decoded.payload.length !== 32) return false;
    return schnorr.verify(
      hexToBytes(input.signatureHex.toLowerCase()),
      personalMessageHash(input.message),
      decoded.payload,
    );
  } catch {
    return false;
  }
}
