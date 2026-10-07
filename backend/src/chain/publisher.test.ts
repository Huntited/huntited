// L'adresse de publication du réseau de test est bien la même clé que celle
// qui possède huntited.kas sur le réseau principal.
import { describe, expect, it } from "vitest";

import { decodeKaspaAddress } from "../services/kaspa-signature.js";
import {
  OFFICIAL_MAINNET_ADDRESS,
  OFFICIAL_PUBLISHER,
} from "../../../src/lib/onchain/publisher.js";

describe("adresse de publication officielle", () => {
  it("même clé que le propriétaire de huntited.kas, sur le réseau de test", () => {
    const main = decodeKaspaAddress(OFFICIAL_MAINNET_ADDRESS);
    const test = decodeKaspaAddress(OFFICIAL_PUBLISHER);
    expect(main.prefix).toBe("kaspa");
    expect(test.prefix).toBe("kaspatest");
    expect(test.version).toBe(main.version);
    expect(Buffer.from(test.payload).equals(Buffer.from(main.payload))).toBe(true);
  });
});
