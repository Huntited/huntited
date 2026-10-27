import { beforeEach, describe, expect, it, vi } from "vitest";

import { collectWalletActivity, getPublicBadges, getWalletBadges } from "./badge-activity";
import { getBadgeVisibility, recordShare, setBadgeVisibility } from "./badge-store";
import { createHuntCovenant } from "./covenants";
import { mockCommit } from "./mock-zk";
import { addUserHunt } from "./user-hunts";

const CREATOR = "kaspatest:qq_creator_badges_aaaa";
const A = "kaspatest:qq_participant_a_bbbb";
const B = "kaspatest:qq_participant_b_cccc";

async function createHunt(threshold: number, progressVisibility: "visible" | "hidden" = "visible") {
  const { huntId } = await createHuntCovenant({
    title: "Action",
    description: "Test",
    location: "Lieu",
    deadline: new Date(Date.now() + 86_400_000).toISOString(),
    threshold,
    deposit: 30,
    commitDeposit: 5,
    progressVisibility,
  });
  addUserHunt(CREATOR, {
    huntId,
    title: "Action",
    location: "Lieu",
    deadline: new Date(Date.now() + 86_400_000).toISOString(),
    threshold,
  });
  return huntId;
}

beforeEach(() => {
  window.localStorage.clear();
  vi.useRealTimers();
});

describe("badges calculés depuis l'activité locale", () => {
  it("rangs, réussite et badges de participation / création", async () => {
    const id = await createHunt(2, "hidden");
    await mockCommit(id, A);
    await mockCommit(id, B);

    const a = collectWalletActivity(A);
    expect(a.participations).toEqual([
      expect.objectContaining({ huntId: id, rank: 1, threshold: 2, result: "success" }),
    ]);
    expect(getWalletBadges(A).map((b) => b.id)).toEqual(["pionnier", "habitue"]);
    expect(getWalletBadges(B).map((b) => b.id)).toEqual(["declencheur", "habitue"]);
    expect(getWalletBadges(CREATOR).map((b) => b.id)).toEqual(["batisseur", "visionnaire"]);
  });

  it("Messager·ère après le partage d'une action qui réussit", async () => {
    const id = await createHunt(1);
    recordShare(B, id);
    expect(getWalletBadges(B)).toEqual([]);
    await mockCommit(id, A);
    expect(getWalletBadges(B).map((b) => b.id)).toEqual(["messager"]);
  });

  it("visibilité : privée par défaut, propre à chaque wallet", async () => {
    const id = await createHunt(1);
    await mockCommit(id, A);
    expect(getBadgeVisibility(A)).toBe("private");
    expect(getPublicBadges(A)).toEqual([]);

    setBadgeVisibility(A, "public");
    expect(getPublicBadges(A).length).toBeGreaterThan(0);
    expect(getBadgeVisibility(B)).toBe("private");

    setBadgeVisibility(A, "private");
    expect(getPublicBadges(A)).toEqual([]);
  });

  it("aucune adresse brute n'est stockée pour les badges", async () => {
    const id = await createHunt(1);
    recordShare(A, id);
    setBadgeVisibility(A, "public");
    for (const key of ["huntited:shares", "huntited:badge-visibility"]) {
      expect(window.localStorage.getItem(key)).not.toContain(A);
    }
  });
});
