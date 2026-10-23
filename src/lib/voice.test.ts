import { schnorr } from "@noble/curves/secp256k1.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { describe, expect, it } from "vitest";

import { chatPublicKey, openMessage, sealMessage } from "./p2p-chat";
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
