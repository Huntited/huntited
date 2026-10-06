import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { indexCities, normalizeCity, searchCities } from "./cities";

const index = indexCities(JSON.parse(readFileSync("public/geo/cities.json", "utf8")));
const first = (q: string) => searchCities(index, q)[0];

describe("recherche de villes (sur l'appareil)", () => {
  it("ignore accents et majuscules", () => {
    expect(normalizeCity(" Genève ")).toBe("geneve");
  });

  it("trouve une ville par le début de son nom, la plus peuplée d'abord", () => {
    expect(first("lond")).toMatchObject({ name: "London", country: "GB" });
    const lille = searchCities(index, "lille").map((c) => c.country);
    expect(lille[0]).toBe("FR");
    expect(lille).toContain("BE");
  });

  it("trouve les grandes villes par leur nom en français", () => {
    expect(first("Londres")).toMatchObject({ name: "London", country: "GB", alias: "Londres" });
    expect(first("Genève")).toMatchObject({ name: "Geneva", country: "CH" });
    expect(first("Varsovie")).toMatchObject({ country: "PL" });
  });

  it("au moins 2 caractères, 8 suggestions au plus", () => {
    expect(searchCities(index, "p")).toEqual([]);
    expect(searchCities(index, "sa")).toHaveLength(8);
  });

  it("base assez complète (≈ 34 000 villes de plus de 15 000 habitants)", () => {
    expect(index.length).toBeGreaterThan(30_000);
  });
});
