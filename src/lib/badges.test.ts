import { describe, expect, it } from "vitest";

import {
  computeBadges,
  type Creation,
  type HuntResult,
  type Participation,
  type WalletActivity,
} from "./badges";

const DAY = 86_400_000;
const t0 = Date.UTC(2026, 0, 15);

const part = (over: Partial<Participation> = {}): Participation => ({
  huntId: "h",
  rank: 5,
  threshold: 10,
  result: "success",
  committedAt: t0,
  ...over,
});

const activity = (over: Partial<WalletActivity> = {}): WalletActivity => ({
  participations: [],
  creations: [],
  sharedResults: [],
  ...over,
});

const ids = (a: WalletActivity) => computeBadges(a).map((b) => b.id);

describe("badges", () => {
  it("aucun badge sans activité", () => {
    expect(computeBadges(activity())).toEqual([]);
  });

  it("Pionnier·ère : 10 % premiers engagés d'une chasse réussie, au moins le premier", () => {
    expect(ids(activity({ participations: [part({ rank: 1, threshold: 10 })] }))).toContain(
      "pionnier",
    );
    expect(ids(activity({ participations: [part({ rank: 2, threshold: 10 })] }))).not.toContain(
      "pionnier",
    );
    expect(ids(activity({ participations: [part({ rank: 5, threshold: 50 })] }))).toContain(
      "pionnier",
    );
    // Chasse échouée ou en cours : pas de badge.
    for (const result of ["failure", "pending"] as const) {
      expect(ids(activity({ participations: [part({ rank: 1, result })] }))).not.toContain(
        "pionnier",
      );
    }
  });

  it("Déclencheur·se : l'engagement qui atteint le seuil", () => {
    expect(ids(activity({ participations: [part({ rank: 10, threshold: 10 })] }))).toContain(
      "declencheur",
    );
    expect(ids(activity({ participations: [part({ rank: 9, threshold: 10 })] }))).not.toContain(
      "declencheur",
    );
  });

  it("Habitué·e : bronze à 1, argent à 5, or à 25 chasses réussies", () => {
    const tierFor = (n: number) =>
      computeBadges(
        activity({
          participations: Array.from({ length: n }, (_, i) => part({ huntId: `h${i}` })),
        }),
      ).find((b) => b.id === "habitue")?.tier;
    expect(tierFor(0)).toBeUndefined();
    expect(tierFor(1)).toBe("bronze");
    expect(tierFor(4)).toBe("bronze");
    expect(tierFor(5)).toBe("argent");
    expect(tierFor(25)).toBe("or");
  });

  it("Série : 3 mois civils consécutifs, pas 3 mois espacés", () => {
    const months = (ms: number[]) =>
      ms.map((m, i) =>
        part({ huntId: `h${i}`, result: "pending", committedAt: Date.UTC(2026, m, 10) }),
      );
    expect(ids(activity({ participations: months([0, 1, 2]) }))).toContain("serie");
    expect(ids(activity({ participations: months([10, 11, 12]) }))).toContain("serie"); // à cheval sur l'année
    expect(ids(activity({ participations: months([0, 2, 4]) }))).not.toContain("serie");
    expect(
      ids(
        activity({ participations: [part({ committedAt: t0 }), part({ committedAt: t0 + DAY })] }),
      ),
    ).not.toContain("serie");
  });

  it("Persévérant·e : 3 chasses échouées", () => {
    const fails = (n: number) =>
      Array.from({ length: n }, (_, i) => part({ huntId: `f${i}`, result: "failure" }));
    expect(ids(activity({ participations: fails(2) }))).not.toContain("perseverant");
    expect(ids(activity({ participations: fails(3) }))).toContain("perseverant");
  });

  it("badges de création", () => {
    const c = (
      commitCount: number,
      progressVisibility: "visible" | "hidden",
      result: HuntResult = "success",
    ): Creation => ({ huntId: "c", result, commitCount, progressVisibility });
    expect(ids(activity({ creations: [c(10, "visible")] }))).toEqual(["batisseur"]);
    expect(ids(activity({ creations: [c(50, "visible")] }))).toEqual(["batisseur", "rassembleur"]);
    expect(ids(activity({ creations: [c(3, "hidden")] }))).toEqual(["batisseur", "visionnaire"]);
    expect(ids(activity({ creations: [{ ...c(80, "hidden"), result: "failure" }] }))).toEqual([]);
  });

  it("Messager·ère : une chasse partagée qui a réussi", () => {
    expect(ids(activity({ sharedResults: ["pending", "failure"] }))).toEqual([]);
    expect(ids(activity({ sharedResults: ["success"] }))).toEqual(["messager"]);
  });
});
