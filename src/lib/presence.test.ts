import { schnorr } from "@noble/curves/secp256k1.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { chatPublicKey, openMessage, sealMessage, type ChatMessage } from "./p2p-chat";
import {
  newPresenceKey,
  presenceCount,
  presenceId,
  presenceMissing,
  presenceState,
  presenceSupported,
  startPresence,
} from "./presence";

const HUNT = "ab".repeat(12);
const DEADLINE = Date.now() + 86_400_000;
const priv = () => bytesToHex(schnorr.utils.randomSecretKey());

async function msg(
  from: string,
  members: string[],
  at: number,
  presence?: { key: string; onsite?: number },
  text = "",
): Promise<ChatMessage> {
  const e = await sealMessage(HUNT, from, members, text, DEADLINE, {
    now: at,
    ...(presence ? { presence } : {}),
  });
  return (await openMessage(HUNT, from, members, e))!;
}

afterEach(() => {
  delete (window as unknown as { HuntitedApp?: unknown }).HuntitedApp;
});

describe("compteur de présence", () => {
  const creator = priv();
  const alice = priv();
  const bob = priv();
  const members = [creator, alice].map(chatPublicKey);

  it("la clé voyage chiffrée dans un message sans texte, lisible par les membres seuls", async () => {
    const key = newPresenceKey();
    const e = await sealMessage(HUNT, alice, members, "", DEADLINE, { presence: { key } });
    const m = await openMessage(HUNT, creator, members, e);
    expect(m?.presence).toEqual({ key });
    expect(m?.text).toBe("");
    expect(e.content).not.toContain(key);
    await expect(sealMessage(HUNT, alice, members, " ", DEADLINE)).rejects.toThrow();
  });

  it("tout le monde retombe sur la même clé ; le créateur fixe le seuil", async () => {
    const k1 = newPresenceKey();
    const k2 = newPresenceKey();
    const early = await msg(alice, members, 1000, { key: k1 });
    const late = await msg(alice, members, 2000, { key: k2 });
    expect(presenceState([late, early], chatPublicKey(creator))?.key).toBe(k1);

    const fromCreator = await msg(creator, members, 3000, { key: k1, onsite: 50 }, "seuil");
    const s = presenceState([early, late, fromCreator], chatPublicKey(creator));
    expect(s).toMatchObject({ key: k1, onsite: 50 });
    expect(presenceState([], undefined)).toBeNull();
  });

  it("renvoie la clé aux membres arrivés après, seulement par son auteur", async () => {
    const key = newPresenceKey();
    const first = await msg(alice, members, 1000, { key });
    const now = [...members, chatPublicKey(bob)];
    const s = presenceState([first], chatPublicKey(creator))!;
    expect(presenceMissing(s, [first], now, chatPublicKey(alice))).toEqual([chatPublicKey(bob)]);
    expect(presenceMissing(s, [first], now, chatPublicKey(creator))).toEqual([]);
    const again = await msg(alice, now, 2000, { key });
    expect(presenceMissing(s, [first, again], now, chatPublicKey(alice))).toEqual([]);
  });

  it("identifiant de présence : stable pour un membre, différent d'un membre à l'autre", () => {
    const key = newPresenceKey();
    expect(presenceId(key, alice)).toBe(presenceId(key, alice));
    expect(presenceId(key, alice)).not.toBe(presenceId(key, bob));
    expect(presenceId(key, alice)).not.toContain(chatPublicKey(alice).slice(0, 16));
  });

  it("passe par l'app Huntited Chat, et ne fait rien ailleurs", () => {
    expect(presenceSupported()).toBe(false);
    expect(presenceCount(HUNT)).toBeNull();
    const presenceStart = vi.fn(() => true);
    (window as unknown as { HuntitedApp: unknown }).HuntitedApp = {
      presenceStart,
      presenceCount: () => 7,
    };
    const key = newPresenceKey();
    expect(startPresence(HUNT, "Titre", { key, onsite: 20 }, alice, 2_000_000)).toBe(true);
    expect(presenceStart).toHaveBeenCalledWith(
      HUNT,
      "Titre",
      key,
      presenceId(key, alice),
      20,
      2000,
    );
    expect(presenceCount(HUNT)).toBe(7);
  });
});
