import { describe, expect, it } from "vitest";

import type { LedgerHunt } from "./onchain/ledger";
import {
  chainDeeds,
  computeXp,
  levelOf,
  questProgress,
  rankOf,
  titleOf,
  weekStart,
  XP_RULES,
  xpForLevel,
} from "./rpg";

const DAY = 24 * 3600 * 1000;
const MONDAY = Date.UTC(2026, 9, 26); // lundi 26 octobre 2026

function hunt(over: Partial<LedgerHunt> & { id: string }): LedgerHunt {
  return {
    title: "t",
    description: "d",
    location: "@online",
    deadline: MONDAY + 3 * DAY,
    threshold: 2,
    deposit: 30,
    progressVisibility: "visible",
    createdAt: MONDAY,
    txId: "x",
    creator: "kaspatest:creator",
    commits: [],
    ...over,
  } as LedgerHunt;
}

const commit = (who: string, at: number) => ({ who, personalThreshold: 2, at, txId: "c" });

describe("XP et niveaux", () => {
  it("aucune XP tant que la chasse ne s'est pas déclenchée", () => {
    const h = hunt({ id: "a", commits: [commit("me", MONDAY + DAY)] });
    expect(computeXp(chainDeeds([h], "me", MONDAY + 2 * DAY)).total).toBe(0);
  });

  it("engagement compté pour le déclenchement, puis action réussie", () => {
    const h = hunt({
      id: "a",
      commits: [commit("me", MONDAY + DAY), commit("other", MONDAY + DAY + 1)],
      activatedAt: MONDAY + DAY + 1,
    });
    const before = computeXp(chainDeeds([h], "me", MONDAY + 2 * DAY));
    expect(before.engage).toBe(XP_RULES.engage + XP_RULES.trigger);
    expect(before.success).toBe(0);
    const after = computeXp(chainDeeds([h], "me", MONDAY + 4 * DAY));
    expect(after.success).toBe(XP_RULES.successMember);
  });

  it("le créateur gagne la création et la réussite ; la classe donne +25 %", () => {
    const h = hunt({ id: "a", creator: "me", activatedAt: MONDAY + DAY });
    const deeds = chainDeeds([h], "me", MONDAY + 4 * DAY);
    expect(computeXp(deeds).create).toBe(XP_RULES.create);
    expect(computeXp(deeds, "stratege").create).toBe(Math.round(XP_RULES.create * 1.25));
    expect(computeXp(deeds).success).toBe(XP_RULES.successCreator);
  });

  it("quêtes de la semaine : seulement des chasses déclenchées", () => {
    const hunts = [
      hunt({ id: "a", commits: [commit("me", MONDAY + DAY)], activatedAt: MONDAY + DAY }),
      hunt({ id: "b", commits: [commit("me", MONDAY + 2 * DAY)], activatedAt: MONDAY + 2 * DAY }),
      hunt({ id: "c", commits: [commit("me", MONDAY + 2 * DAY)] }), // jamais déclenchée
    ];
    const deeds = chainDeeds(hunts, "me", MONDAY + 2 * DAY + 1);
    const p = questProgress(deeds, weekStart(MONDAY + 3 * DAY));
    expect(p.twoCommits).toBe(2);
    expect(p.triggered).toBe(2);
    expect(computeXp(deeds).quests).toBe(30 + 50);
  });

  it("courbe des niveaux et titres", () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(100);
    expect(levelOf(99)).toBe(1);
    expect(levelOf(100)).toBe(2);
    expect(levelOf(300)).toBe(3);
    expect(titleOf(1)).toBe("recrue");
    expect(titleOf(15)).toBe("legende");
    expect(rankOf(150)).toMatchObject({ level: 2, from: 100, to: 300 });
  });

  it("semaine du lundi au dimanche (UTC)", () => {
    expect(weekStart(MONDAY + 6 * DAY + 5)).toBe(MONDAY);
    expect(weekStart(MONDAY - 1)).toBe(MONDAY - 7 * DAY);
  });
});
