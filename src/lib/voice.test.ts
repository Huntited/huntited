import { schnorr } from "@noble/curves/secp256k1.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { describe, expect, it } from "vitest";

import {
  CHAT_TTL_AFTER_DEADLINE_MS,
  chatPublicKey,
  expired,
  forgetChatKey,
  getChatKey,
  importChatKey,
  openMessage,
  sealMessage,
} from "./p2p-chat";
import { audioSrc } from "./voice";

const HUNT = "ab".repeat(12);
const DEADLINE = Date.now() + 86_400_000;
const priv = () => bytesToHex(schnorr.utils.randomSecretKey());
const clip = {
  mime: "audio/webm;codecs=opus",
  data: "GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYEC",
  ms: 2300,
};

describe("messages vocaux", () => {
  const alice = priv();
  const bob = priv();
  const members = [alice, bob].map(chatPublicKey);

  it("un vocal voyage chiffré et se relit chez les membres", async () => {
    const e = await sealMessage(HUNT, alice, members, "", DEADLINE, { audio: clip });
    expect(e.content).not.toContain(clip.data);
    const m = await openMessage(HUNT, bob, members, e);
    expect(m?.audio).toEqual(clip);
    expect(m?.text).toBe("");
  });

  it("talkie-walkie : le drapeau voyage avec le son", async () => {
    const e = await sealMessage(HUNT, alice, members, "", DEADLINE, {
      audio: { ...clip, ptt: true },
    });
    expect((await openMessage(HUNT, bob, members, e))?.audio?.ptt).toBe(true);
  });

  it("refuse un son trop long, trop gros ou d'un autre type", async () => {
    for (const bad of [
      { ...clip, ms: 120_000 },
      { ...clip, data: "A".repeat(90_000) },
      { ...clip, mime: "text/html" },
      { ...clip, data: "<script>" },
    ]) {
      await expect(
        sealMessage(HUNT, alice, members, "", DEADLINE, { audio: bad }),
      ).rejects.toThrow();
    }
  });

  it("se lit dans <audio> sans réseau (adresse data:)", () => {
    expect(audioSrc(clip)).toBe(`data:audio/webm;base64,${clip.data}`);
  });
});

describe("messages éphémères", () => {
  const alice = priv();
  const bob = priv();
  const members = [alice, bob].map(chatPublicKey);

  it("un message éphémère porte sa date de fin, relais compris", async () => {
    const now = Date.now();
    const e = await sealMessage(HUNT, alice, members, "RDV 18 h", DEADLINE, {
      now,
      ttl: 3_600_000,
    });
    expect(e.tags).toContainEqual(["expiration", String(Math.floor((now + 3_600_000) / 1000))]);
    const m = (await openMessage(HUNT, bob, members, e))!;
    expect(m.exp).toBe(now + 3_600_000);
    expect(expired(m, now + 3_600_001)).toBe(true);
    expect(expired(m, now)).toBe(false);
  });

  it("ne dépasse jamais la fermeture du salon ; sans durée, pas d'expiration propre", async () => {
    const now = Date.now();
    const close = now + 60_000;
    const e = await sealMessage(HUNT, alice, members, "x", close - CHAT_TTL_AFTER_DEADLINE_MS, {
      now,
      ttl: 24 * 3_600_000,
    });
    expect((await openMessage(HUNT, bob, members, e))!.exp).toBe(close);
    const plain = await sealMessage(HUNT, alice, members, "x", DEADLINE, { now });
    expect((await openMessage(HUNT, bob, members, plain))!.exp).toBeUndefined();
  });

  it("le réglage du créateur voyage chiffré ; une durée inconnue est ignorée", async () => {
    const e = await sealMessage(HUNT, alice, members, "", DEADLINE, { room: { ttl: 3_600_000 } });
    expect((await openMessage(HUNT, bob, members, e))!.room).toEqual({ ttl: 3_600_000 });
    await expect(
      sealMessage(HUNT, alice, members, "", DEADLINE, { room: { ttl: 42 } }),
    ).rejects.toThrow();
  });

  it("oublier un salon efface sa clé et son pseudo, pas ceux des autres", () => {
    const other = "cd".repeat(12);
    importChatKey(HUNT, alice);
    importChatKey(other, bob);
    forgetChatKey(HUNT);
    expect(getChatKey(HUNT)).toBeNull();
    expect(getChatKey(other)).toBe(bob);
  });
});
