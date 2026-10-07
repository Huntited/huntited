// Adresse du registre : une adresse dont personne ne connaît la clé privée.
//
// On part d'une phrase publique (« huntited:registry:v1 ») et on en tire,
// par hachage, un point de la courbe. Personne ne peut connaître la clé
// privée correspondante : les KAS envoyés à cette adresse (0,2 KAS par
// action, le minimum de Kastle) ne peuvent être dépensés par personne, et
// n'importe qui peut refaire le calcul pour le vérifier.
import { createHash } from "node:crypto";

import { secp256k1 } from "@noble/curves/secp256k1.js";
import { bytesToHex } from "@noble/hashes/utils.js";

import { ADDRESS_VERSION_PUBKEY, encodeKaspaAddress } from "../services/kaspa-signature.js";

export const REGISTRY_LABEL = "huntited:registry:v1";

/** Montant envoyé avec chaque message (minimum accepté par Kastle). */
export const REGISTRY_FEE_SOMPI = 20_000_000n;

/** Clé publique x-only « sans clé privée connue », dérivée de `label`. */
export function numsPublicKey(label: string): Uint8Array {
  for (let i = 0; ; i++) {
    const x = createHash("sha256").update(`${label}:${i}`).digest();
    try {
      secp256k1.Point.fromHex(`02${bytesToHex(x)}`);
      return x;
    } catch {
      /* pas sur la courbe : essai suivant */
    }
  }
}

export function registryAddress(prefix = "kaspatest", label = REGISTRY_LABEL): string {
  return encodeKaspaAddress(prefix, ADDRESS_VERSION_PUBKEY, numsPublicKey(label));
}
