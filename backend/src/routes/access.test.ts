// Tests d'autorisation de l'accès au chat (app Express réelle, port éphémère).
// Les wallets sont de vraies clés Schnorr : chaque accès passe par un défi
// signé et vérifié comme le ferait Kastle.
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { schnorr } from "@noble/curves/secp256k1.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { afterEach, describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { AuthService, fingerprintWallet } from "../services/auth-service.js";
import { ChallengeService } from "../services/challenge-service.js";
import { ChatService } from "../services/chat-service.js";
import { MemoryChatStore } from "../services/chat-store.js";
import { MockHuntAccessStore } from "../services/hunt-access-store.js";
import { encodeKaspaAddress, personalMessageHash } from "../services/kaspa-signature.js";
import { MockMatrixService } from "../services/matrix-service.js";
import { createSignatureVerifier } from "../services/wallet-auth.js";

const SECRET = "x".repeat(40);

interface TestWallet {
  address: string;
  secret: Uint8Array;
}

function makeWallet(prefix = "kaspatest"): TestWallet {
  const secret = schnorr.utils.randomSecretKey();
  return { secret, address: encodeKaspaAddress(prefix, 0, schnorr.getPublicKey(secret)) };
}

const sign = (w: TestWallet, message: string) =>
  bytesToHex(schnorr.sign(personalMessageHash(message), w.secret));

const CREATOR = makeWallet();
const PART = makeWallet();
const OUTSIDER = makeWallet();

let server: Server | undefined;
afterEach(() => server?.close());

async function setup(now: () => number = Date.now) {
  const access = new MockHuntAccessStore();
  access.seedHunt({ huntId: "h_on", status: "activated" });
  access.seedHunt({ huntId: "h_other", status: "activated" });
  access.seedHunt({ huntId: "h_active", status: "active" });
  for (const id of ["h_on", "h_other", "h_active"]) {
    access.seedRole({
      huntId: id,
      walletFingerprint: fingerprintWallet(CREATOR.address),
      role: "creator",
    });
    access.seedRole({
      huntId: id,
      walletFingerprint: fingerprintWallet(PART.address),
      role: "participant",
    });
  }
  const auth = new AuthService(SECRET, 900, now);
  const app = createApp({
    chat: new ChatService(new MemoryChatStore(), new MockMatrixService("https://matrix.test")),
    auth,
    access,
    challenges: new ChallengeService({ appUri: "http://localhost", network: "testnet-10", now }),
    verifySignature: createSignatureVerifier("signature", "testnet-10"),
    corsOrigin: "http://localhost",
    nodeEnv: "test",
  });
  server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const post = (path: string, body: unknown, token?: string) =>
    fetch(base + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  const get = (path: string, token?: string) =>
    fetch(base + path, token ? { headers: { Authorization: `Bearer ${token}` } } : {});

  const challenge = async (huntId: string, walletAddress: string) => {
    const r = await post("/api/auth/challenge", { huntId, walletAddress });
    return {
      status: r.status,
      body: (await r.json()) as { challengeId: string; message: string; expiresAt: number },
    };
  };
  const access_ = async (body: Record<string, unknown>) => {
    const r = await post("/api/auth/chat-access", body);
    return { status: r.status, body: (await r.json()) as Record<string, unknown> };
  };
  /** Parcours complet : défi → signature → jeton. */
  const tokenFor = async (huntId: string, w: TestWallet) => {
    const c = await challenge(huntId, w.address);
    if (c.status !== 200) return { status: c.status, body: {} as Record<string, unknown> };
    return access_({
      huntId,
      walletAddress: w.address,
      challengeId: c.body.challengeId,
      signature: sign(w, c.body.message),
    });
  };
  return { post, get, challenge, access: access_, tokenFor, auth };
}

const chatBody = (huntId: string) => ({
  huntId,
  huntName: "Test",
  expiresAt: Date.now() + 3_600_000,
});

describe("défi signé", () => {
  it("le message à signer est rédigé par le serveur et précise l'intention", async () => {
    const { challenge } = await setup();
    const c = await challenge("h_on", CREATOR.address);
    expect(c.status).toBe(200);
    expect(c.body.challengeId).toMatch(/^[0-9a-f]{32}$/);
    for (const part of [
      CREATOR.address,
      "URI: http://localhost",
      "Network: kaspa:testnet-10",
      `Nonce: ${c.body.challengeId}`,
      "Purpose: Access Huntited chat for hunt h_on",
      "This signature does not send any KAS.",
    ]) {
      expect(c.body.message).toContain(part);
    }
  });

  it("aucun défi pour une hunt active ou inconnue", async () => {
    const { challenge } = await setup();
    expect((await challenge("h_active", CREATOR.address)).status).toBe(409);
    expect((await challenge("h_inconnue", CREATOR.address)).status).toBe(404);
  });

  it("une signature valide donne un jeton", async () => {
    const { tokenFor } = await setup();
    const r = await tokenFor("h_on", CREATOR);
    expect(r.status).toBe(200);
    expect(typeof r.body["accessToken"]).toBe("string");
  });

  it("refuse la signature d'un autre wallet (adresse usurpée)", async () => {
    const { challenge, access } = await setup();
    const c = await challenge("h_on", CREATOR.address);
    const r = await access({
      huntId: "h_on",
      walletAddress: CREATOR.address,
      challengeId: c.body.challengeId,
      signature: sign(OUTSIDER, c.body.message),
    });
    expect(r.status).toBe(401);
  });

  it("refuse une signature sur un autre message que celui du serveur", async () => {
    const { challenge, access } = await setup();
    const c = await challenge("h_on", CREATOR.address);
    const r = await access({
      huntId: "h_on",
      walletAddress: CREATOR.address,
      challengeId: c.body.challengeId,
      signature: sign(CREATOR, c.body.message.replace("h_on", "h_other")),
    });
    expect(r.status).toBe(401);
  });

  it("un défi ne sert qu'une fois (rejeu refusé, même après échec)", async () => {
    const { challenge, access } = await setup();
    const c = await challenge("h_on", CREATOR.address);
    const body = {
      huntId: "h_on",
      walletAddress: CREATOR.address,
      challengeId: c.body.challengeId,
      signature: sign(CREATOR, c.body.message),
    };
    expect((await access(body)).status).toBe(200);
    expect((await access(body)).status).toBe(401);

    const c2 = await challenge("h_on", CREATOR.address);
    const bad = { ...body, challengeId: c2.body.challengeId, signature: "00".repeat(64) };
    expect((await access(bad)).status).toBe(401);
    const retry = { ...bad, signature: sign(CREATOR, c2.body.message) };
    expect((await access(retry)).status).toBe(401);
  });

  it("refuse un défi expiré", async () => {
    let now = Date.now();
    const { challenge, access } = await setup(() => now);
    const c = await challenge("h_on", CREATOR.address);
    now += 5 * 60_000 + 1;
    const r = await access({
      huntId: "h_on",
      walletAddress: CREATOR.address,
      challengeId: c.body.challengeId,
      signature: sign(CREATOR, c.body.message),
    });
    expect(r.status).toBe(401);
  });

  it("refuse un défi utilisé pour une autre hunt", async () => {
    const { challenge, access } = await setup();
    const c = await challenge("h_on", CREATOR.address);
    const r = await access({
      huntId: "h_other",
      walletAddress: CREATOR.address,
      challengeId: c.body.challengeId,
      signature: sign(CREATOR, c.body.message),
    });
    expect(r.status).toBe(401);
  });

  it("refuse une adresse mainnet, même correctement signée", async () => {
    const { tokenFor } = await setup();
    expect((await tokenFor("h_on", makeWallet("kaspa"))).status).toBe(401);
  });
});

describe("accès au chat", () => {
  it("refusé pour une hunt active", async () => {
    const { tokenFor } = await setup();
    expect((await tokenFor("h_active", CREATOR)).status).toBe(409);
  });

  it("refusé pour un wallet sans rôle", async () => {
    const { tokenFor } = await setup();
    expect((await tokenFor("h_on", OUTSIDER)).status).toBe(401);
  });

  it("jeton expiré refusé", async () => {
    let now = Date.now();
    const { tokenFor, get } = await setup(() => now);
    const t = (await tokenFor("h_on", CREATOR)).body["accessToken"] as string;
    now += 901_000;
    expect((await get("/api/chats/h_on", t)).status).toBe(401);
  });

  it("un·e engagé·e ne peut pas créer de room, mais peut lire une room active", async () => {
    const { tokenFor, post, get } = await setup();
    const tp = (await tokenFor("h_on", PART)).body["accessToken"] as string;
    expect((await post("/api/chats", chatBody("h_on"), tp)).status).toBe(403);
    const tc = (await tokenFor("h_on", CREATOR)).body["accessToken"] as string;
    expect((await post("/api/chats", chatBody("h_on"), tc)).status).toBe(201);
    const r = await get("/api/chats/h_on", tp);
    expect(r.status).toBe(200);
    expect(((await r.json()) as { isActive: boolean }).isActive).toBe(true);
  });

  it("le jeton d'une hunt ne permet pas d'en lire une autre", async () => {
    const { tokenFor, get, post } = await setup();
    const t = (await tokenFor("h_on", CREATOR)).body["accessToken"] as string;
    expect((await get("/api/chats/h_other", t)).status).toBe(401);
    expect((await post("/api/chats", chatBody("h_other"), t)).status).toBe(401);
  });

  it("sans jeton : 401", async () => {
    const { post } = await setup();
    expect((await post("/api/chats", chatBody("h_on"))).status).toBe(401);
  });

  it("aucune réponse publique ne contient fingerprint, roomId ou token Matrix", async () => {
    const { tokenFor, post, get } = await setup();
    const auth = await tokenFor("h_on", CREATOR);
    expect(Object.keys(auth.body).sort()).toEqual(["accessToken", "expiresAt"]);
    const t = auth.body["accessToken"] as string;
    const texts = [
      JSON.stringify(auth.body),
      await (await post("/api/chats", chatBody("h_on"), t)).text(),
      await (await get("/api/chats/h_on", t)).text(),
    ];
    const fp = fingerprintWallet(CREATOR.address);
    for (const txt of texts.slice(1)) {
      expect(txt).not.toContain("roomId");
      expect(txt).not.toContain("!mock_");
    }
    for (const txt of texts) {
      expect(txt).not.toContain(fp);
      expect(txt).not.toContain(CREATOR.address);
    }
  });
});

describe("mode mock (développement)", () => {
  it("n'accepte que les signatures du wallet factice", () => {
    const verify = createSignatureVerifier("mock", "testnet-10");
    const base = { message: "m", walletAddress: "kaspa:mockabc" };
    expect(verify({ ...base, signature: `mocksig_${"ab".repeat(32)}` })).toBe(true);
    expect(verify({ ...base, signature: "00".repeat(64) })).toBe(false);
  });
});
