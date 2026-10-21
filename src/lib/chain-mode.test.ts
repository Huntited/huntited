// Mode « chain » : création et engagement envoyés par Kastle au registre,
// lecture par l'index, chasse « en cours d'inscription » en attendant.
import { beforeEach, describe, expect, it, vi } from "vitest";

const sent = vi.hoisted(() => ({ calls: [] as { to: string; sompi: number; payload: string }[] }));
vi.mock("./wallet", async (orig) => ({
  ...(await orig<typeof import("./wallet")>()),
  sendToRegistry: vi.fn(async (to: string, sompi: number, payload: string) => {
    sent.calls.push({ to, sompi, payload });
    return "txid";
  }),
}));
// Index dans le navigateur : la chasse n'y est pas encore (≈ 1 min de délai).
const index = vi.hoisted(() => ({
  getChainHunt: vi.fn(async (_id: string) => null),
  listChainHunts: vi.fn(async () => []),
}));
vi.mock("./onchain/browser-index", () => index);
const api = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock("./api-client", async (orig) => ({
  ...(await orig<typeof import("./api-client")>()),
  apiFetch: api.apiFetch,
}));

import { REGISTRY_ADDRESS, REGISTRY_FEE_SOMPI } from "./chain";
import { commit, createHunt, getHuntView, isCommitted } from "./hunt-repository";

const ADDR = `kaspatest:${"q".repeat(61)}`;
const decode = (hex: string) =>
  new TextDecoder().decode(Uint8Array.from(hex.match(/../g)!.map((b) => parseInt(b, 16))));

beforeEach(() => {
  localStorage.clear();
  sent.calls = [];
  api.apiFetch.mockReset();
  vi.stubEnv("VITE_DATA_MODE", "chain");
});

describe("mode chaîne", () => {
  it("crée une chasse par une transaction au registre, visible « en cours » avant l'index", async () => {
    const id = await createHunt(
      {
        title: " Conseil ",
        description: "Ensemble",
        location: "Mairie",
        country: "FR",
        deadline: "2030-01-01T20:00",
        threshold: 7,
        deposit: 30,
        commitDeposit: 5,
        progressVisibility: "hidden",
      },
      ADDR,
    );
    expect(id).toMatch(/^[0-9a-f]{24}$/);
    expect(sent.calls).toHaveLength(1);
    const { to, sompi, payload } = sent.calls[0]!;
    expect(to).toBe(REGISTRY_ADDRESS);
    expect(sompi).toBe(REGISTRY_FEE_SOMPI);
    const text = decode(payload);
    expect(text.startsWith("HNT1")).toBe(true);
    expect(JSON.parse(text.slice(4))).toMatchObject({
      t: "hunt",
      id,
      title: "Conseil",
      threshold: 7,
      progressVisibility: "hidden",
      deadline: new Date("2030-01-01T20:00").getTime(),
    });
    // Pas encore indexée : affichage provisoire, sans aucun appel à un serveur Huntited.
    const view = await getHuntView(id);
    expect(view).toMatchObject({ pending: true, commitsOpen: false });
    expect(view?.hunt.title).toBe("Conseil");
    expect(index.getChainHunt).toHaveBeenCalledWith(id);
    expect(api.apiFetch).not.toHaveBeenCalled();
  });

  it("engagement : seuil personnel dans le message, un seul par wallet", async () => {
    const hunt = "a".repeat(24);
    await commit(hunt, ADDR, 9);
    expect(JSON.parse(decode(sent.calls[0]!.payload).slice(4))).toEqual({
      t: "commit",
      hunt,
      threshold: 9,
      // Clé publique de chat (chat chiffré entre membres), créée sur l'appareil.
      chat: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(isCommitted(hunt, ADDR)).toBe(true);
    await expect(commit(hunt, ADDR)).rejects.toThrow("déjà engagé");
    expect(sent.calls).toHaveLength(1); // pas de 0,2 KAS perdus pour rien
  });
});
