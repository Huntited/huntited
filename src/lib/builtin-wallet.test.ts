import { schnorr } from "@noble/curves/secp256k1.js";
import { hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";
import { afterEach, describe, expect, it } from "vitest";

import {
  builtinAddress,
  builtinPhrase,
  builtinProtection,
  isLocked,
  lockBuiltin,
  protectBuiltin,
  setUnlockHandler,
  unlockBuiltin,
  unlockWaitSeconds,
  createBuiltinWallet,
  hasBuiltinWallet,
  importBuiltinWallet,
  networkOf,
  removeBuiltinWallet,
} from "./builtin-wallet";
import { addressScript, decodeAddress, encodeAddress } from "./kaspa/address";
import {
  buildTransaction,
  MAX_TX_MASS,
  MIN_RELAY_FEE_PER_GRAM,
  sigHash,
  signTransaction,
  toRpc,
  transactionMass,
  type Utxo,
} from "./kaspa/tx";

/** Phrase de test standard (BIP39) ; adresses calculées par le SDK officiel de Kaspa. */
const PHRASE =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const TESTNET = "kaspatest:qqd6e65yefepe9wk0m9vuxdufxd80sphy67gwwd0vdaumzdt4tc9ssxd5s7gn";
const MAINNET = "kaspa:qqd6e65yefepe9wk0m9vuxdufxd80sphy67gwwd0vdaumzdt4tc9s3qt0lqeh";

afterEach(() => {
  removeBuiltinWallet();
  setUnlockHandler(null);
  delete (window as unknown as { HuntitedApp?: unknown }).HuntitedApp;
});

describe("protection du wallet", () => {
  const protect = (code: string | null, bio = false, wipeAfter = 0) =>
    protectBuiltin({ code, codeKind: "pin", bio, lockAfterMs: 0, wipeAfter });

  it("code : la phrase est chiffrée, l'adresse reste lisible, le bon code déverrouille", async () => {
    importBuiltinWallet(PHRASE);
    await protect("123456");
    expect(localStorage.getItem("huntited:builtin-wallet")).not.toContain("abandon");
    expect(builtinProtection()).toMatchObject({ code: "pin", bio: false });
    lockBuiltin();
    expect(isLocked()).toBe(true);
    expect(builtinAddress("kaspatest")).toBe(TESTNET);
    await expect(builtinPhrase()).rejects.toThrow("locked"); // pas de fenêtre de déverrouillage
    expect(await unlockBuiltin("000000")).toBe("bad");
    expect(await unlockBuiltin("123456")).toBe("ok");
    expect(await builtinPhrase()).toBe(PHRASE);
    expect(isLocked()).toBe(true); // « à chaque opération » : reverrouillé après usage
  }, 30_000);

  it("demande le déverrouillage à l'écran quand il faut la clé", async () => {
    importBuiltinWallet(PHRASE);
    await protect("123456");
    lockBuiltin();
    setUnlockHandler(async () => (await unlockBuiltin("123456")) === "ok");
    expect(await builtinPhrase()).toBe(PHRASE);
  }, 30_000);

  it("après 5 codes faux, il faut attendre ; option : effacement après 10", async () => {
    importBuiltinWallet(PHRASE);
    await protect("123456", false, 10);
    lockBuiltin();
    for (let i = 0; i < 5; i++) expect(await unlockBuiltin("999999")).toBe("bad");
    expect(unlockWaitSeconds()).toBeGreaterThan(0);
    expect(await unlockBuiltin("123456")).toBe("wait");
    // On saute l'attente pour arriver aux 10 erreurs.
    for (let i = 0; i < 5; i++) {
      const s = JSON.parse(localStorage.getItem("huntited:builtin-wallet")!);
      localStorage.setItem("huntited:builtin-wallet", JSON.stringify({ ...s, waitUntil: 0 }));
      await unlockBuiltin("999999");
    }
    expect(hasBuiltinWallet()).toBe(false);
  }, 120_000);

  it("empreinte (app) : chiffrée par l'app, déverrouillée après confirmation", async () => {
    // Fausse app : « chiffre » par un XOR, répond comme l'app (window.__huntitedBio).
    const reply = (id: string, ok: boolean, r: string) =>
      setTimeout(() =>
        (
          window as unknown as { __huntitedBio: (a: string, b: boolean, c: string) => void }
        ).__huntitedBio(id, ok, r),
      );
    let refuse = false;
    const xor = (d: string) =>
      btoa(String.fromCharCode(...[...atob(d)].map((c) => c.charCodeAt(0) ^ 0x55)));
    (window as unknown as { HuntitedApp: unknown }).HuntitedApp = {
      bioAvailable: () => true,
      bioEncrypt: (id: string, d: string) => reply(id, true, xor(d)),
      bioDecrypt: (id: string, d: string) => reply(id, !refuse, refuse ? "cancelled" : xor(d)),
    };
    importBuiltinWallet(PHRASE);
    await protect("123456", true);
    expect(builtinProtection()).toMatchObject({ code: "pin", bio: true });
    lockBuiltin();
    refuse = true;
    expect(await unlockBuiltin("123456")).toBe("cancelled");
    refuse = false;
    expect(await unlockBuiltin("123456")).toBe("ok");
  }, 30_000);

  it("retirer la protection remet la phrase en clair", async () => {
    importBuiltinWallet(PHRASE);
    await protect("123456");
    await unlockBuiltin("123456");
    await protect(null);
    expect(isLocked()).toBe(false);
    expect(builtinProtection()).toMatchObject({ code: null, bio: false });
  }, 30_000);
});

describe("wallet intégré", () => {
  it("retrouve le même compte que Kastle et Kaspium avec la même phrase", async () => {
    expect(importBuiltinWallet(`  ${PHRASE.toUpperCase()} `)).toBe(true);
    expect(builtinAddress("kaspatest")).toBe(TESTNET);
    expect(builtinAddress("kaspa")).toBe(MAINNET);
    expect(await builtinPhrase()).toBe(PHRASE);
  });

  it("crée une phrase de 12 mots, refuse une phrase fausse, se retire", async () => {
    expect(hasBuiltinWallet()).toBe(false);
    const phrase = createBuiltinWallet();
    expect(phrase.split(" ")).toHaveLength(12);
    expect(hasBuiltinWallet()).toBe(true);
    expect(importBuiltinWallet("abandon abandon abandon")).toBe(false);
    expect(await builtinPhrase()).toBe(phrase); // une phrase fausse ne remplace rien
    removeBuiltinWallet();
    expect(hasBuiltinWallet()).toBe(false);
    expect(builtinAddress("kaspatest")).toBeNull();
  });

  it("réseau déduit de l'adresse", () => {
    expect(networkOf(TESTNET)).toBe("testnet-10");
    expect(networkOf(MAINNET)).toBe("mainnet");
  });
});

describe("adresses Kaspa", () => {
  it("encode et décode (somme de contrôle comprise)", () => {
    const { prefix, version, payload } = decodeAddress(TESTNET);
    expect(prefix).toBe("kaspatest");
    expect(version).toBe(0);
    expect(encodeAddress(prefix, version, payload)).toBe(TESTNET);
    expect(() => decodeAddress(TESTNET.slice(0, -1) + "q")).toThrow();
    expect(addressScript(TESTNET)).toEqual(new Uint8Array([0x20, ...payload, 0xac]));
  });
});

describe("transactions", () => {
  const key = hexToBytes("11".repeat(32));
  const me = encodeAddress("kaspatest", 0, schnorr.getPublicKey(key));
  const script = addressScript(me);
  const utxo = (amount: bigint, i: number): Utxo => ({
    transactionId: i.toString(16).padStart(64, "0"),
    index: 0,
    amount,
    script: Buffer.from(script).toString("hex"),
  });
  const registry = { amount: 20_000_000n, script: addressScript(TESTNET) };
  const payload = utf8ToBytes('HNT1{"t":"commit"}');

  it("paie la sortie, les frais minimaux, et rend la monnaie", () => {
    const { tx, fee } = buildTransaction([utxo(10_000_000_000n, 1)], [registry], script, payload);
    expect(tx.outputs[0]).toEqual(registry);
    const change = tx.outputs[1]!.amount;
    expect(10_000_000_000n - 20_000_000n - change).toBe(fee);
    expect(fee).toBeGreaterThan(0n);
    expect(transactionMass(tx)).toBeLessThanOrEqual(MAX_TX_MASS);
    // Frais au moins égaux au relais minimal des nœuds.
    expect(fee).toBeGreaterThanOrEqual(1000n * MIN_RELAY_FEE_PER_GRAM);
  });

  it("assemble plusieurs petites entrées ; refuse s'il n'y a pas assez", () => {
    const small = [utxo(15_000_000n, 1), utxo(15_000_000n, 2), utxo(15_000_000n, 3)];
    const { tx } = buildTransaction(small, [registry], script, payload);
    expect(tx.inputs.length).toBeGreaterThanOrEqual(2);
    expect(() => buildTransaction([utxo(20_000_000n, 1)], [registry], script, payload)).toThrow(
      "insufficient_funds",
    );
  });

  it("signe chaque entrée (Schnorr sur son hachage) au format attendu par le nœud", () => {
    const { tx } = buildTransaction([utxo(10_000_000_000n, 1)], [registry], script, payload);
    const signed = signTransaction(tx, key);
    const sigScript = signed.inputs[0]!.signatureScript;
    expect(sigScript[0]).toBe(0x41);
    expect(sigScript[65]).toBe(1);
    expect(schnorr.verify(sigScript.slice(1, 65), sigHash(tx, 0), schnorr.getPublicKey(key))).toBe(
      true,
    );
    const rpc = toRpc(signed);
    expect(rpc.outputs[0]!.scriptPublicKey).toBe(
      `0000${Buffer.from(registry.script).toString("hex")}`,
    );
    expect(rpc.payload).toBe(Buffer.from(payload).toString("hex"));
  });

  it("le hachage change si le message change (le message est bien signé)", () => {
    const { tx } = buildTransaction([utxo(10_000_000_000n, 1)], [registry], script, payload);
    const other = { ...tx, payload: utf8ToBytes("HNT1{}") };
    expect(sigHash(tx, 0)).not.toEqual(sigHash(other, 0));
  });
});
