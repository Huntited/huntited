import { describe, expect, it } from "vitest";

import { COUNTRY_CODES, countryName, isCountryCode, sortedCountries } from "./countries";
import type { HuntView } from "./hunt-repository";
import { filterHuntViews } from "./registry";

describe("pays", () => {
  it("contient les 249 codes ISO et le Kosovo, sans doublon", () => {
    expect(COUNTRY_CODES).toHaveLength(250);
    expect(new Set(COUNTRY_CODES).size).toBe(250);
    expect(isCountryCode("FR")).toBe(true);
    expect(isCountryCode("fr")).toBe(false);
    expect(isCountryCode("XX")).toBe(false);
    expect(countryName("XK", "fr")).toBe("Kosovo");
  });

  it("nomme les pays dans la langue choisie", () => {
    expect(countryName("DE", "fr")).toBe("Allemagne");
    expect(countryName("DE", "en")).toBe("Germany");
  });

  it("trie par nom dans la langue choisie", () => {
    const names = sortedCountries("fr", ["ES", "DE", "BE"]).map((c) => c.name);
    expect(names).toEqual(["Allemagne", "Belgique", "Espagne"]);
  });

  it("le filtre par pays ne garde que les chasses de ce pays", () => {
    const view = (id: string, country?: string) =>
      ({
        hunt: {
          id,
          title: id,
          description: "",
          location: "",
          deadline: new Date(Date.now() + 86_400_000).toISOString(),
          threshold: 7,
          deposit: 30,
          commitDeposit: 5,
          commitCount: 0,
          status: "active",
          ...(country ? { country } : {}),
        },
        status: "active",
        commitCount: 0,
        retainedCount: 0,
        retainedThreshold: null,
        commitsOpen: true,
      }) as HuntView;
    const views = [view("a", "FR"), view("b", "BE"), view("c")];
    expect(filterHuntViews(views, { country: "FR" }).map((v) => v.hunt.id)).toEqual(["a"]);
    expect(filterHuntViews(views).map((v) => v.hunt.id)).toHaveLength(3);
  });
});
