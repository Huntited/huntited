// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { clearMockCommitments, getMockCommitCount, hasMockCommitment, mockCommit } from "./mock-zk";

const WALLET_A = "kaspa:qpwalletaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const WALLET_B = "kaspa:qpwalletbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

beforeEach(() => {
  localStorage.clear();
  clearMockCommitments();
});

describe("engagements mockés", () => {
  it("un wallet peut créer un engagement", async () => {
    const r = await mockCommit("hunt_abc", WALLET_A);
    expect(r.commitment).toMatch(/^[0-9a-f]{64}$/);
    expect(hasMockCommitment("hunt_abc", WALLET_A)).toBe(true);
  });

  it("le même wallet ne peut pas s'engager deux fois dans la même hunt", async () => {
    await mockCommit("hunt_abc", WALLET_A);
    await expect(mockCommit("hunt_abc", WALLET_A)).rejects.toThrow();
  });

  it("deux wallets différents peuvent s'engager dans la même hunt", async () => {
    await mockCommit("hunt_abc", WALLET_A);
    await mockCommit("hunt_abc", WALLET_B);
    expect(getMockCommitCount("hunt_abc")).toBe(2);
  });

  it("le compteur augmente seulement sur un nouvel engagement", async () => {
    expect(getMockCommitCount("hunt_abc", 7)).toBe(7);
    await mockCommit("hunt_abc", WALLET_A);
    expect(getMockCommitCount("hunt_abc", 7)).toBe(8);
    await mockCommit("hunt_abc", WALLET_A).catch(() => undefined);
    expect(getMockCommitCount("hunt_abc", 7)).toBe(8);
    expect(getMockCommitCount("autre_hunt", 0)).toBe(0);
  });

  it("le stockage ne contient pas l'adresse brute du wallet", async () => {
    await mockCommit("hunt_abc", WALLET_A);
    const dump = Object.keys(localStorage)
      .map((k) => localStorage.getItem(k) ?? "")
      .join("\n");
    expect(dump).not.toContain(WALLET_A);
    expect(dump).not.toContain("qpwalletaaaa");
    const records = JSON.parse(localStorage.getItem("huntited:mock-commitments") ?? "[]");
    expect(Object.keys(records[0]).sort()).toEqual(["commitment", "createdAt", "huntId", "walletFingerprint"]);
  });
});
