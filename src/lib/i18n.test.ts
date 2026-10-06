import { afterEach, describe, expect, it, vi } from "vitest";

import { formatDate, translate } from "./i18n";
import { en } from "./messages/en";
import { fr } from "./messages/fr";

afterEach(() => {
  vi.resetModules();
  window.localStorage.clear();
});

describe("traductions", () => {
  it("chaque texte existe dans les deux langues, sans texte vide", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort());
    for (const dict of [fr, en]) {
      for (const value of Object.values(dict)) expect(value.trim()).not.toBe("");
    }
  });

  it("les deux langues utilisent les mêmes variables", () => {
    const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const key of Object.keys(fr) as (keyof typeof fr)[]) {
      expect(vars(en[key]), key).toEqual(vars(fr[key]));
    }
  });

  it("remplace les variables", () => {
    expect(translate("fr", "home.card.progress", { count: 3, threshold: 7 })).toBe(
      "3 sur 7 engagés",
    );
    expect(translate("en", "home.card.progress", { count: 3, threshold: 7 })).toBe(
      "3 of 7 committed",
    );
  });

  it("formate les dates selon la langue", () => {
    const d = "2026-10-20T16:00:00.000Z";
    expect(formatDate("fr", d, { dateStyle: "long", timeZone: "UTC" })).toBe("20 octobre 2026");
    expect(formatDate("en", d, { dateStyle: "long", timeZone: "UTC" })).toBe("20 October 2026");
  });

  it("suit le choix mémorisé, sinon la langue du navigateur", async () => {
    vi.spyOn(navigator, "language", "get").mockReturnValue("en-US");
    expect((await import("./i18n")).getLocale()).toBe("en");

    vi.resetModules();
    vi.spyOn(navigator, "language", "get").mockReturnValue("fr-FR");
    expect((await import("./i18n")).getLocale()).toBe("fr");

    vi.resetModules();
    window.localStorage.setItem("huntited:locale", "en");
    expect((await import("./i18n")).getLocale()).toBe("en");
  });
});
