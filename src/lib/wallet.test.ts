// Mode Kastle du wallet, avec une fausse extension window.kastle.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TEST_ADDRESS = "kaspatest:qq_test_address_aaaa";

function fakeKastle(opts: { network?: string; connect?: boolean } = {}) {
  let network = opts.network ?? "testnet-10";
  const handlers: Record<string, ((v: unknown) => void)[]> = {};
  const kastle = {
    connect: vi.fn(async () => opts.connect ?? true),
    disconnect: vi.fn(async () => undefined),
    getAccount: vi.fn(async () => ({ address: TEST_ADDRESS, publicKey: "pk" })),
    getNetwork: vi.fn(async () => network),
    switchNetwork: vi.fn(async (id: string) => (network = id)),
    signMessage: vi.fn(async (m: string) => `sig:${m}`),
    // Fonctions d'envoi de l'API Kastle : ne doivent jamais être appelées.
    sendKaspa: vi.fn(),
    signAndBroadcastTx: vi.fn(),
    signTx: vi.fn(),
    on: vi.fn((event: string, h: (v: unknown) => void) => {
      (handlers[event] ??= []).push(h);
    }),
    emit: (event: string, value: unknown) => handlers[event]?.forEach((h) => h(value)),
  };
  Object.assign(window, { kastle });
  return kastle;
}

async function loadWallet() {
  vi.resetModules();
  return import("./wallet");
}

beforeEach(() => {
  window.localStorage.clear();
  vi.stubEnv("VITE_WALLET_MODE", "kastle");
});

afterEach(() => {
  vi.unstubAllEnvs();
  delete (window as { kastle?: unknown }).kastle;
});

describe("wallet en mode Kastle", () => {
  it("sans extension : erreur explicite, pas de connexion", async () => {
    const w = await loadWallet();
    await expect(w.connectWallet()).rejects.toThrow("Extension Kastle introuvable");
    expect(w.getWalletState().isConnected).toBe(false);
  });

  it("connexion refusée : erreur explicite", async () => {
    fakeKastle({ connect: false });
    const w = await loadWallet();
    await expect(w.connectWallet()).rejects.toThrow("Connexion refusée");
    expect(w.getWalletState().isConnected).toBe(false);
  });

  it("connecte sur testnet-10 avec l'adresse Kastle", async () => {
    const k = fakeKastle();
    const w = await loadWallet();
    expect(await w.connectWallet()).toBe(TEST_ADDRESS);
    expect(w.getWalletState()).toEqual({ isConnected: true, address: TEST_ADDRESS });
    expect(k.switchNetwork).not.toHaveBeenCalled();
  });

  it("demande le passage sur testnet-10 si Kastle est sur mainnet", async () => {
    const k = fakeKastle({ network: "mainnet" });
    const w = await loadWallet();
    await w.connectWallet();
    expect(k.switchNetwork).toHaveBeenCalledWith("testnet-10");
  });

  it("refuse de rester sur mainnet", async () => {
    const k = fakeKastle({ network: "mainnet" });
    k.switchNetwork.mockRejectedValue(new Error("user rejected"));
    const w = await loadWallet();
    await expect(w.connectWallet()).rejects.toThrow("testnet-10");
    expect(w.getWalletState().isConnected).toBe(false);
  });

  it("un échec de lecture du compte laisse le wallet déconnecté", async () => {
    const k = fakeKastle();
    k.getAccount.mockRejectedValue(new Error("locked"));
    const w = await loadWallet();
    await expect(w.connectWallet()).rejects.toThrow();
    expect(w.getWalletState()).toEqual({ isConnected: false, address: null });
  });

  it("un changement de compte pendant la connexion retient le dernier compte", async () => {
    const k = fakeKastle();
    let calls = 0;
    k.getAccount.mockImplementation(async () => {
      calls += 1;
      // Au premier appel, l'utilisateur change de compte dans Kastle.
      if (calls === 1) {
        k.emit("kas:account_changed", "kaspatest:qq_other_bbbb");
        return { address: TEST_ADDRESS, publicKey: "pk" };
      }
      return { address: "kaspatest:qq_other_bbbb", publicKey: "pk2" };
    });
    const w = await loadWallet();
    expect(await w.connectWallet()).toBe("kaspatest:qq_other_bbbb");
    expect(w.getWalletState().address).toBe("kaspatest:qq_other_bbbb");
  });

  it("migre l'ancienne clé de stockage vers la clé neutre", async () => {
    window.localStorage.setItem(
      "huntited:mock-wallet",
      JSON.stringify({ isConnected: true, address: TEST_ADDRESS }),
    );
    vi.stubEnv("VITE_WALLET_MODE", "mock");
    const w = await loadWallet();
    expect(w.getWalletState().address).toBe(TEST_ADDRESS);
    expect(window.localStorage.getItem("huntited:mock-wallet")).toBeNull();
    expect(window.localStorage.getItem("huntited:wallet")).toContain(TEST_ADDRESS);
  });

  it("se déconnecte si l'extension change de réseau", async () => {
    const k = fakeKastle();
    const w = await loadWallet();
    await w.connectWallet();
    k.emit("kas:network_changed", "mainnet");
    expect(w.getWalletState().isConnected).toBe(false);
  });

  it("suit le changement de compte et le verrouillage", async () => {
    const k = fakeKastle();
    const w = await loadWallet();
    await w.connectWallet();
    k.emit("kas:account_changed", "kaspatest:qq_other_bbbb");
    expect(w.getWalletState().address).toBe("kaspatest:qq_other_bbbb");
    k.emit("kas:account_changed", null);
    expect(w.getWalletState().isConnected).toBe(false);
  });

  it("signe via Kastle et n'utilise aucune fonction d'envoi", async () => {
    const k = fakeKastle();
    const w = await loadWallet();
    await w.connectWallet();
    expect(await w.signMessage("defi")).toBe("sig:defi");
    w.disconnectWallet();
    expect(k.sendKaspa).not.toHaveBeenCalled();
    expect(k.signAndBroadcastTx).not.toHaveBeenCalled();
    expect(k.signTx).not.toHaveBeenCalled();
  });

  it("revalide une session restaurée et la coupe si Kastle a changé de réseau", async () => {
    window.localStorage.setItem(
      "huntited:wallet",
      JSON.stringify({ isConnected: true, address: TEST_ADDRESS }),
    );
    fakeKastle({ network: "mainnet" });
    const w = await loadWallet();
    const seen: boolean[] = [];
    w.subscribeWallet((s) => seen.push(s.isConnected));
    await vi.waitFor(() => expect(w.getWalletState().isConnected).toBe(false));
    expect(seen[0]).toBe(true);
  });
});
