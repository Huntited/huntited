import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./hunt-repository", () => ({ getDataMode: () => "chain" }));

import { closeGuide, guideBeforeConnect, needsGuide } from "./wallet-guide";

beforeEach(() => {
  localStorage.clear();
  vi.stubEnv("VITE_WALLET_MODE", "kastle");
});

describe("conseils « compte dédié »", () => {
  it("s'affichent avant la première connexion de Kastle, puis plus jamais", async () => {
    expect(needsGuide()).toBe(false); // pas d'extension : rien à conseiller
    (window as unknown as { kastle?: object }).kastle = {};
    expect(needsGuide()).toBe(true);
    const cancelled = guideBeforeConnect();
    closeGuide(false);
    expect(await cancelled).toBe(false);
    expect(needsGuide()).toBe(true); // annulé : on les reverra

    const go = guideBeforeConnect();
    closeGuide(true);
    expect(await go).toBe(true);
    expect(needsGuide()).toBe(false);
    delete (window as unknown as { kastle?: object }).kastle;
  });

  it("jamais avec le wallet factice", () => {
    vi.stubEnv("VITE_WALLET_MODE", "mock");
    expect(needsGuide()).toBe(false);
  });
});
