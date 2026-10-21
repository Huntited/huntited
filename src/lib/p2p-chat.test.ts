import { bytesToHex } from "@noble/hashes/utils.js";
import { schnorr } from "@noble/curves/secp256k1.js";
import { beforeEach, describe, expect, it } from "vitest";

import {
  chatPublicKey,
  ensureChatKey,
  getChatKey,
  openMessage,
  sealMessage,
  verifyEvent,
} from "./p2p-chat";

const HUNT = "ab".repeat(12);
const DEADLINE = Date.UTC(2026, 11, 1);
const newKey = () => bytesToHex(schnorr.utils.randomSecretKey());

describe("chat chiffré entre membres", () => {
  const [alice, bob, carol, eve] = [newKey(), newKey(), newKey(), newKey()];
  const members = [alice, bob, carol].map(chatPublicKey);

  it("chaque membre lit le message ; une personne extérieure ne peut pas", async () => {
    const e = await sealMessage(HUNT, alice, members, "  RDV 18 h devant la mairie ", DEADLINE);
    expect(verifyEvent(e)).toBe(true);
    expect(e.content).not.toContain("mairie"); // illisible pour les relais
    for (const k of [alice, bob, carol]) {
      const m = await openMessage(HUNT, k, members, e);
      expect(m?.text).toBe("RDV 18 h devant la mairie");
      expect(m?.author).toBe(chatPublicKey(alice));
    }
    expect(await openMessage(HUNT, eve, [...members, chatPublicKey(eve)], e)).toBeNull();
  });

  it("ignore un message d'une clé qui n'est pas membre", async () => {
    const e = await sealMessage(HUNT, eve, [...members, chatPublicKey(eve)], "intrus", DEADLINE);
    expect(await openMessage(HUNT, bob, members, e)).toBeNull();
  });

  it("ignore un message modifié ou destiné à une autre chasse", async () => {
    const e = await sealMessage(HUNT, alice, members, "bonjour", DEADLINE);
    expect(
      await openMessage(HUNT, bob, members, { ...e, content: e.content.replace("A", "B") }),
    ).toBeNull();
    expect(await openMessage("cd".repeat(12), bob, members, e)).toBeNull();
    const other = await sealMessage("cd".repeat(12), alice, members, "ailleurs", DEADLINE);
    expect(await openMessage(HUNT, bob, members, other)).toBeNull();
  });

  it("le message expire 24 h après la date limite (NIP-40)", async () => {
    const e = await sealMessage(HUNT, alice, members, "x", DEADLINE);
    const exp = e.tags.find((t) => t[0] === "expiration")?.[1];
    expect(Number(exp)).toBe((DEADLINE + 86_400_000) / 1000);
  });
});

describe("clé de chat du navigateur", () => {
  beforeEach(() => localStorage.clear());

  it("créée une fois par chasse, puis réutilisée", () => {
    const pub = ensureChatKey(HUNT);
    expect(pub).toMatch(/^[0-9a-f]{64}$/);
    expect(ensureChatKey(HUNT)).toBe(pub);
    expect(chatPublicKey(getChatKey(HUNT)!)).toBe(pub);
    expect(ensureChatKey("cd".repeat(12))).not.toBe(pub);
  });
});

describe("clé invalide inscrite sur la chaîne", () => {
  it("n'empêche pas les autres membres d'écrire et de lire", async () => {
    const [alice, bob] = [newKey(), newKey()];
    const members = [chatPublicKey(alice), "11".repeat(32), chatPublicKey(bob)];
    const e = await sealMessage(HUNT, alice, members, "ok", DEADLINE);
    expect((await openMessage(HUNT, bob, members, e))?.text).toBe("ok");
  });
});
