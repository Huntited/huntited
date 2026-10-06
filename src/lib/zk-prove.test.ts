import { Group, Identity, generateProof, verifyProof } from "@semaphore-protocol/core";
import { describe, expect, it } from "vitest";

import { generateProofSingleThread } from "./zk-prove";

const ARTIFACTS = { wasm: "public/zk/semaphore-20.wasm", zkey: "public/zk/semaphore-20.zkey" };

describe("preuve sur un seul fil", () => {
  it("équivaut à la preuve de la bibliothèque Semaphore et se vérifie", async () => {
    const ids = [new Identity(), new Identity(), new Identity()];
    const group = new Group(ids.map((i) => i.commitment));

    const mine = await generateProofSingleThread(ids[1]!, group, 8, "hunt:abc", 20, ARTIFACTS);
    const theirs = await generateProof(ids[1]!, group, 8, "hunt:abc", 20, ARTIFACTS);

    expect(await verifyProof(mine)).toBe(true);
    for (const key of ["merkleTreeDepth", "merkleTreeRoot", "nullifier", "message", "scope"]) {
      expect(mine[key as keyof typeof mine]).toEqual(theirs[key as keyof typeof theirs]);
    }
  }, 60_000);

  it("refuse un pass absent du groupe", async () => {
    const group = new Group([new Identity().commitment]);
    await expect(
      generateProofSingleThread(new Identity(), group, 0, "hunt:abc", 20, ARTIFACTS),
    ).rejects.toThrow("Ce pass ne fait pas partie du groupe.");
  });
});
