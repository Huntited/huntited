import { describe, expect, it } from "vitest";
import { canOpenChat, canSettle, deriveHuntStatus, isProgressVisible } from "./hunt-lifecycle";

const deadline = "2026-10-10T18:00:00Z";
const before = new Date("2026-10-09T12:00:00Z").getTime();
const after = new Date("2026-10-11T12:00:00Z").getTime();
const hunt = { status: "active" as const, threshold: 10, deadline };

describe("deriveHuntStatus", () => {
  it("active avant la deadline et sous le seuil", () => {
    expect(deriveHuntStatus(hunt, 7, before)).toBe("active");
  });

  it("activated quand le seuil est atteint", () => {
    expect(deriveHuntStatus(hunt, 10, before)).toBe("activated");
  });

  it("activated si le seuil est atteint, même relu après la deadline", () => {
    expect(deriveHuntStatus(hunt, 10, after)).toBe("activated");
  });

  it("expired si la deadline est dépassée sans seuil", () => {
    expect(deriveHuntStatus(hunt, 7, after)).toBe("expired");
  });

  it("settled si le statut est settled", () => {
    expect(deriveHuntStatus({ ...hunt, status: "settled" }, 3, after)).toBe("settled");
  });
});

describe("permissions par statut", () => {
  it("chat uniquement après activation", () => {
    expect(canOpenChat("active")).toBe(false);
    expect(canOpenChat("expired")).toBe(false);
    expect(canOpenChat("activated")).toBe(true);
    expect(canOpenChat("settled", "success")).toBe(true);
    expect(canOpenChat("settled", "failure")).toBe(false);
  });

  it("résolution après activation ou expiration", () => {
    expect(canSettle("activated")).toBe(true);
    expect(canSettle("expired")).toBe(true);
    expect(canSettle("active")).toBe(false);
    expect(canSettle("settled")).toBe(false);
  });
});

describe("visibilité de la progression", () => {
  it("visible par défaut, quel que soit le statut", () => {
    expect(isProgressVisible({}, "active")).toBe(true);
    expect(isProgressVisible({ progressVisibility: "visible" }, "active")).toBe(true);
  });

  it("masquée pendant la phase d'engagement, révélée ensuite", () => {
    const hidden = { progressVisibility: "hidden" as const };
    expect(isProgressVisible(hidden, "draft")).toBe(false);
    expect(isProgressVisible(hidden, "active")).toBe(false);
    for (const s of ["activated", "expired", "settled"] as const) {
      expect(isProgressVisible(hidden, s)).toBe(true);
    }
  });
});
