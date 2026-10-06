import { afterEach, describe, expect, it, vi } from "vitest";

import { MIN_THRESHOLD } from "./hunt-economics";
import type { HuntFormData } from "./types";
import { minHuntThreshold, validateHuntForm } from "./validation";

afterEach(() => vi.unstubAllEnvs());

const form = (threshold: number): HuntFormData => ({
  title: "Titre",
  description: "Description",
  location: "Lieu",
  deadline: new Date(Date.now() + 86_400_000).toISOString().slice(0, 16),
  threshold,
  deposit: 30,
  commitDeposit: 5,
});

describe("seuil minimum", () => {
  it(`refuse un seuil inférieur à ${MIN_THRESHOLD}`, () => {
    expect(MIN_THRESHOLD).toBe(7);
    expect(validateHuntForm(form(6)).threshold).toBe("Le seuil doit être d'au moins 7 personnes.");
    expect(validateHuntForm(form(7)).threshold).toBeUndefined();
  });

  it("n'est abaissable qu'en développement, jamais au-dessus de 7", () => {
    vi.stubEnv("VITE_MIN_THRESHOLD", "2");
    vi.stubEnv("DEV", true);
    expect(minHuntThreshold()).toBe(2);
    expect(validateHuntForm(form(2)).threshold).toBeUndefined();

    vi.stubEnv("DEV", false);
    expect(minHuntThreshold()).toBe(MIN_THRESHOLD);

    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_MIN_THRESHOLD", "50");
    expect(minHuntThreshold()).toBe(MIN_THRESHOLD);
  });
});
