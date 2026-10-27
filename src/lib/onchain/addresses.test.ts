// Deux adresses dont dépend la confiance dans Huntited, vérifiables par tous.
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { describe, expect, it } from "vitest";

import { REGISTRY_ADDRESS } from "../chain";
import { decodeAddress, encodeAddress } from "../kaspa/address";
import { OFFICIAL_MAINNET_ADDRESS, OFFICIAL_PUBLISHER } from "./publisher";

/**
 * Clé publique « sans clé privée connue » tirée d'une phrase publique : le
 * premier sha256(phrase:i) qui est l'abscisse d'un point de la courbe.
 */
function numsPublicKey(label: string): Uint8Array {
  for (let i = 0; ; i++) {
    const x = sha256(utf8ToBytes(`${label}:${i}`));
    try {
      secp256k1.Point.fromHex(`02${bytesToHex(x)}`);
      return x;
    } catch {
      /* pas sur la courbe : essai suivant */
    }
  }
}

describe("adresses publiques", () => {
  it("registre : dérivé de « huntited:registry:v1 », personne n'en connaît la clé", () => {
    // Version 0 : clé publique Schnorr. Les KAS envoyés là ne peuvent être dépensés par personne.
    expect(encodeAddress("kaspatest", 0, numsPublicKey("huntited:registry:v1"))).toBe(
      REGISTRY_ADDRESS,
    );
  });

  it("publication : même clé que le propriétaire de huntited.kas, sur le réseau de test", () => {
    const main = decodeAddress(OFFICIAL_MAINNET_ADDRESS);
    const test = decodeAddress(OFFICIAL_PUBLISHER);
    expect(main.prefix).toBe("kaspa");
    expect(test.prefix).toBe("kaspatest");
    expect(test.version).toBe(main.version);
    expect(bytesToHex(test.payload)).toBe(bytesToHex(main.payload));
  });
});
