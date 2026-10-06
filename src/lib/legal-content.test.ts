import { describe, expect, it } from "vitest";

import { LEGAL_CONTACT, legalSections } from "./legal-content";

describe("page légale", () => {
  it("mêmes sections et même structure en français et en anglais", () => {
    const fr = legalSections("fr");
    const en = legalSections("en");
    expect(fr.map((s) => s.id)).toEqual(["conditions", "privacy", "charter"]);
    expect(en.map((s) => s.id)).toEqual(fr.map((s) => s.id));
    fr.forEach((s, i) => {
      expect(en[i]!.blocks.map((b) => b.paragraphs.length)).toEqual(
        s.blocks.map((b) => b.paragraphs.length),
      );
    });
  });

  it("le contact est renseigné partout", () => {
    for (const locale of ["fr", "en"] as const) {
      const text = JSON.stringify(legalSections(locale));
      expect(text).not.toContain("[contact]");
      expect(text).toContain(LEGAL_CONTACT);
    }
  });
});
