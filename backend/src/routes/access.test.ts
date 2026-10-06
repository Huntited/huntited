// Authentification (défi signé → session) et accès au chat via le registre.
import type { Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";

import { fingerprintWallet } from "../services/auth-service.js";
import { makeWallet, signWith, startApp } from "../test-helpers.js";

const CREATOR = makeWallet();
const PART = makeWallet();
const OUTSIDER = makeWallet();

let server: Server | undefined;
afterEach(() => server?.close());

async function setup(now?: () => number) {
  const app = await startApp(now ? { now } : {});
  server = app.server;
  return app;
}

const chatBody = (huntId: string) => ({
  huntId,
  huntName: "Test",
  expiresAt: Date.now() + 3_600_000,
});

/** Chasse activée : créée par CREATOR (seuil 1), PART engagé·e. */
async function activatedHunt(app: Awaited<ReturnType<typeof setup>>) {
  const tc = await app.login(CREATOR);
  const tp = await app.login(PART);
  const id = (await app.createHunt(tc, { threshold: 1 })).body["id"] as string;
  await app.post(`/api/hunts/${id}/commit`, {}, tp);
  return { id, tc, tp };
}

describe("défi signé et session", () => {
  it("le message à signer est rédigé par le serveur", async () => {
    const { post } = await setup();
    const c = await post("/api/auth/challenge", { walletAddress: CREATOR.address });
    expect(c.status).toBe(200);
    for (const part of [
      CREATOR.address,
      "URI: http://localhost",
      "Network: kaspa:testnet-10",
      `Nonce: ${c.body["challengeId"]}`,
      "Purpose: Sign in to Huntited",
      "This signature does not send any KAS.",
    ]) {
      expect(c.body["message"]).toContain(part);
    }
  });

  it("une signature valide donne une session", async () => {
    const { login } = await setup();
    expect(typeof (await login(CREATOR))).toBe("string");
  });

  it("refuse la signature d'un autre wallet, un message altéré et le rejeu", async () => {
    const { post } = await setup();
    const c = await post("/api/auth/challenge", { walletAddress: CREATOR.address });
    const base = { walletAddress: CREATOR.address, challengeId: c.body["challengeId"] };
    const msg = c.body["message"] as string;
    expect(
      (await post("/api/auth/session", { ...base, signature: signWith(OUTSIDER, msg) })).status,
    ).toBe(401);
    // Défi consommé par la tentative précédente : même une bonne signature est refusée.
    expect(
      (await post("/api/auth/session", { ...base, signature: signWith(CREATOR, msg) })).status,
    ).toBe(401);

    const c2 = await post("/api/auth/challenge", { walletAddress: CREATOR.address });
    const ok = { walletAddress: CREATOR.address, challengeId: c2.body["challengeId"] };
    expect(
      (await post("/api/auth/session", { ...ok, signature: signWith(CREATOR, msg + "!") })).status,
    ).toBe(401);
  });

  it("refuse un défi expiré et une adresse mainnet", async () => {
    let now = Date.now();
    const { post, login } = await setup(() => now);
    const c = await post("/api/auth/challenge", { walletAddress: CREATOR.address });
    now += 5 * 60_000 + 1;
    const r = await post("/api/auth/session", {
      walletAddress: CREATOR.address,
      challengeId: c.body["challengeId"],
      signature: signWith(CREATOR, c.body["message"] as string),
    });
    expect(r.status).toBe(401);
    expect(await login(makeWallet("kaspa"))).toBeUndefined();
  });

  it("un jeton de session n'est pas un jeton de chat, et inversement", async () => {
    const app = await setup();
    const { id, tc } = await activatedHunt(app);
    // Session utilisée comme jeton de chat : refusée.
    expect((await app.get(`/api/chats/${id}`, tc)).status).toBe(401);
    const chat = (await app.post("/api/auth/chat-access", { huntId: id }, tc)).body[
      "accessToken"
    ] as string;
    // Jeton de chat utilisé comme session : refusé.
    expect((await app.createHunt(chat)).status).toBe(401);
  });
});

describe("accès au chat", () => {
  it("refusé tant que la chasse n'est pas activée", async () => {
    const app = await setup();
    const tc = await app.login(CREATOR);
    const id = (await app.createHunt(tc, { threshold: 5 })).body["id"] as string;
    expect((await app.post("/api/auth/chat-access", { huntId: id }, tc)).status).toBe(409);
    expect((await app.post("/api/auth/chat-access", { huntId: "inconnue" }, tc)).status).toBe(404);
  });

  it("refusé sans session et pour un wallet sans rôle", async () => {
    const app = await setup();
    const { id } = await activatedHunt(app);
    expect((await app.post("/api/auth/chat-access", { huntId: id })).status).toBe(401);
    const to = await app.login(OUTSIDER);
    expect((await app.post("/api/auth/chat-access", { huntId: id }, to)).status).toBe(401);
  });

  it("jeton de chat expiré refusé", async () => {
    let now = Date.now();
    const app = await setup(() => now);
    const { id, tc } = await activatedHunt(app);
    const t = (await app.post("/api/auth/chat-access", { huntId: id }, tc)).body[
      "accessToken"
    ] as string;
    now += 901_000;
    expect((await app.get(`/api/chats/${id}`, t)).status).toBe(401);
  });

  it("le salon s'ouvre tout seul au déclenchement, pour le créateur comme pour les engagé·es", async () => {
    const app = await setup();
    const { id, tc, tp } = await activatedHunt(app);
    for (const session of [tp, tc]) {
      const t = (await app.post("/api/auth/chat-access", { huntId: id }, session)).body[
        "accessToken"
      ] as string;
      const r = await app.get(`/api/chats/${id}`, t);
      expect(r.status).toBe(200);
      expect(r.body["isActive"]).toBe(true);
    }
  });

  it("un·e engagé·e peut rouvrir le salon ; nom et expiration viennent du registre", async () => {
    const app = await setup();
    const { id, tp } = await activatedHunt(app);
    const t = (await app.post("/api/auth/chat-access", { huntId: id }, tp)).body[
      "accessToken"
    ] as string;
    // Une expiration fantaisiste envoyée par le client est ignorée.
    const far = Date.now() + 10 * 365 * 86_400_000;
    const r = await app.post("/api/chats", { ...chatBody(id), expiresAt: far }, t);
    expect(r.status).toBe(201);
    expect(r.body["expiresAt"]).toBeLessThan(far);
  });

  it("le jeton d'une chasse ne permet pas d'en lire une autre", async () => {
    const app = await setup();
    const { id, tc } = await activatedHunt(app);
    const other = await activatedHunt(app);
    const t = (await app.post("/api/auth/chat-access", { huntId: id }, tc)).body[
      "accessToken"
    ] as string;
    expect((await app.get(`/api/chats/${other.id}`, t)).status).toBe(401);
    expect((await app.post("/api/chats", chatBody(other.id), t)).status).toBe(401);
  });

  it("aucune réponse publique ne contient empreinte, adresse, roomId ou token Matrix", async () => {
    const app = await setup();
    const { id, tc } = await activatedHunt(app);
    const auth = await app.post("/api/auth/chat-access", { huntId: id }, tc);
    expect(Object.keys(auth.body).sort()).toEqual(["accessToken", "expiresAt"]);
    const t = auth.body["accessToken"] as string;
    const texts = [
      (await app.post("/api/chats", chatBody(id), t)).text,
      (await app.get(`/api/chats/${id}`, t)).text,
      (await app.get("/api/hunts")).text,
      (await app.get(`/api/hunts/${id}`)).text,
    ];
    const fp = fingerprintWallet(CREATOR.address);
    for (const txt of texts) {
      expect(txt).not.toContain("roomId");
      expect(txt).not.toContain("!mock_");
      expect(txt).not.toContain(fp);
      expect(txt).not.toContain(CREATOR.address);
    }
  });
});

describe("mode mock (développement)", () => {
  it("n'accepte que les signatures du wallet factice", async () => {
    const { createSignatureVerifier } = await import("../services/wallet-auth.js");
    const verify = createSignatureVerifier("mock", "testnet-10");
    const base = { message: "m", walletAddress: "kaspa:mockabc" };
    expect(verify({ ...base, signature: `mocksig_${"ab".repeat(32)}` })).toBe(true);
    expect(verify({ ...base, signature: "00".repeat(64) })).toBe(false);
  });
});
