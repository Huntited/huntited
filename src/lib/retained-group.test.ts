import { describe, expect, it } from "vitest";

import { computeRetainedGroup, isRetained } from "./retained-group";

/** Référence exhaustive : taille du plus grand sous-ensemble valide. */
function bruteForce(ts: number[], T: number): number {
  let best = 0;
  for (let mask = 1; mask < 1 << ts.length; mask += 1) {
    const members = ts.filter((_, i) => mask & (1 << i));
    const size = members.length;
    if (size >= T && members.every((t) => t <= size)) best = Math.max(best, size);
  }
  return best;
}

describe("computeRetainedGroup", () => {
  it("exemple du document : 3,3,4,10 (T=3) → pas de groupe ; +3 → groupe de 4", () => {
    expect(computeRetainedGroup([3, 3, 4, 10], 3)).toEqual({
      retainedThreshold: null,
      retainedCount: 0,
    });
    expect(computeRetainedGroup([3, 3, 4, 10, 3], 3)).toEqual({
      retainedThreshold: 4,
      retainedCount: 4,
    });
  });

  it("tous au seuil de la chasse : comportement actuel (activation à T)", () => {
    expect(computeRetainedGroup([5, 5, 5, 5], 5).retainedCount).toBe(0);
    expect(computeRetainedGroup([5, 5, 5, 5, 5], 5)).toEqual({
      retainedThreshold: 5,
      retainedCount: 5,
    });
    expect(computeRetainedGroup([5, 5, 5, 5, 5, 5, 5], 5).retainedCount).toBe(7);
  });

  it("aucun engagement : pas de groupe", () => {
    expect(computeRetainedGroup([], 1).retainedThreshold).toBeNull();
  });

  it("une exigence élevée reste hors du groupe jusqu'à être satisfaite", () => {
    const g = computeRetainedGroup([2, 2, 25], 2);
    expect(g.retainedCount).toBe(2);
    expect(isRetained(2, g)).toBe(true);
    expect(isRetained(25, g)).toBe(false);
  });

  it("identique à la recherche exhaustive sur 3 000 cas aléatoires", () => {
    let seed = 42;
    const rand = (n: number) => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed % n;
    };
    for (let run = 0; run < 3000; run += 1) {
      const T = 1 + rand(4);
      const n = rand(11);
      const ts = Array.from({ length: n }, () => T + rand(8));
      const g = computeRetainedGroup(ts, T);
      expect(g.retainedCount).toBe(bruteForce(ts, T));
      // Le groupe retenu est exactement { t ≤ k* } et chacun y est satisfait.
      if (g.retainedThreshold !== null) {
        expect(ts.filter((t) => t <= g.retainedThreshold!).length).toBe(g.retainedCount);
        expect(g.retainedCount).toBeGreaterThanOrEqual(g.retainedThreshold);
      }
    }
  });

  it("ne fait que grandir quand on ajoute des engagements", () => {
    let seed = 7;
    const rand = (n: number) => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed % n;
    };
    for (let run = 0; run < 500; run += 1) {
      const T = 1 + rand(3);
      const ts: number[] = [];
      let previous = 0;
      for (let i = 0; i < 12; i += 1) {
        ts.push(T + rand(6));
        const size = computeRetainedGroup(ts, T).retainedCount;
        expect(size).toBeGreaterThanOrEqual(previous);
        previous = size;
      }
    }
  });
});
