import { describe, expect, it } from "vitest";

import { huntIdFrom } from "./moderation";

describe("modération : identifiant de chasse", () => {
  it("accepte un lien du site ou l'identifiant seul", () => {
    const id = "f03353dffd6c40f72abfce44";
    expect(huntIdFrom(`https://huntited.com/#/hunt/${id}`)).toBe(id);
    expect(huntIdFrom(`  ${id} `)).toBe(id);
    expect(huntIdFrom(`https://huntited.com/hunt/${id}?x=1`)).toBe(id);
    expect(huntIdFrom("https://huntited.com/#/hunt/zzz")).toBeNull();
    expect(huntIdFrom(`${id}0`)).toBeNull();
  });
});
