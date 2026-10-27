import { describe, expect, it } from "vitest";

import { MIN_THRESHOLD } from "./hunt-economics";
import { HUNT_TEMPLATES, hasPlaceholder, suggestedDeadline, templateText } from "./hunt-templates";
import { ONLINE_LOCATION } from "./online";
import { validateHuntForm } from "./validation";

describe("modèles d'action", () => {
  it("chaque modèle a un texte dans les deux langues, valide une fois rempli", () => {
    const ids = new Set<string>();
    for (const tpl of HUNT_TEMPLATES) {
      expect(ids.has(tpl.id)).toBe(false);
      ids.add(tpl.id);
      expect(tpl.threshold).toBeGreaterThanOrEqual(MIN_THRESHOLD);
      for (const locale of ["fr", "en"] as const) {
        const text = templateText(tpl.id, locale);
        expect(text.title.length).toBeLessThanOrEqual(80);
        // Le modèle brut contient des passages à remplacer…
        expect(hasPlaceholder(text.title) || hasPlaceholder(text.description)).toBe(true);
        // … et devient valide une fois ceux-ci remplacés.
        const fill = (s: string) => s.replace(/\[[^\]]+\]/g, "X");
        const errors = validateHuntForm(
          {
            title: fill(text.title),
            description: fill(text.description),
            location: tpl.online ? ONLINE_LOCATION : "Paris",
            country: tpl.online ? "" : "FR",
            deadline: suggestedDeadline(tpl.days),
            threshold: tpl.threshold,
            deposit: 30,
            commitDeposit: 5,
            progressVisibility: "hidden",
          },
          locale,
        );
        expect(errors).toEqual({});
      }
    }
  });

  it("refuse de créer une action avec des passages [à remplacer]", () => {
    const errors = validateHuntForm({
      title: "Nettoyons [le parc] ensemble",
      description: "Rendez-vous à [lieu]",
      location: "Paris",
      country: "FR",
      deadline: suggestedDeadline(7),
      threshold: 10,
      deposit: 30,
      commitDeposit: 5,
      progressVisibility: "visible",
    });
    expect(errors.title).toContain("crochets");
    expect(errors.description).toContain("crochets");
  });

  it("date limite conseillée : dans N jours, à 20 h", () => {
    expect(suggestedDeadline(14, new Date(2026, 9, 6, 9, 30))).toBe("2026-10-20T20:00");
    expect(suggestedDeadline(30, new Date(2026, 11, 15))).toBe("2027-01-14T20:00");
  });
});
