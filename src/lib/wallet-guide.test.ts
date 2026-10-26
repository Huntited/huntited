import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ apiFetch: vi.fn(), hasBackend: () => true }));
vi.mock("./api-client", () => api);
vi.mock("./hunt-repository", () => ({ getDataMode: () => "api" }));

import { checkAddressOnce, closeGuide, guideBeforeConnect, needsGuide } from "./wallet-guide";

const ADDR = `kaspatest:${"q".repeat(61)}`;

beforeEach(() => {
  localStorage.clear();
  api.apiFetch.mockReset();
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

  it("vérifie une adresse de test une seule fois, par le serveur Huntited", async () => {
    api.apiFetch.mockResolvedValue({ usedElsewhere: true, reasons: ["sent_elsewhere"] });
    expect(await checkAddressOnce(ADDR)).toEqual({
      usedElsewhere: true,
      reasons: ["sent_elsewhere"],
    });
    expect(api.apiFetch).toHaveBeenCalledWith("POST", "/api/wallet/exposure", { address: ADDR });
    expect(await checkAddressOnce(ADDR)).toBeNull();
    expect(api.apiFetch).toHaveBeenCalledTimes(1);
    // Adresse du réseau principal : jamais vérifiée.
    expect(await checkAddressOnce("kaspa:qqmain")).toBeNull();
  });

  it("service indisponible : rien n'est affiché, on réessaiera", async () => {
    api.apiFetch.mockRejectedValue(new Error("503"));
    expect(await checkAddressOnce(ADDR)).toBeNull();
    api.apiFetch.mockResolvedValue({ usedElsewhere: false, reasons: [] });
    expect(await checkAddressOnce(ADDR)).toEqual({ usedElsewhere: false, reasons: [] });
  });
});
