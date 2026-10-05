// Tests d'autorisation de l'accès au chat (app Express réelle, port éphémère).
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { AuthService, fingerprintWallet } from "../services/auth-service.js";
import { ChatService } from "../services/chat-service.js";
import { MemoryChatStore } from "../services/chat-store.js";
import { MockHuntAccessStore } from "../services/hunt-access-store.js";
import { MockMatrixService } from "../services/matrix-service.js";

const SECRET = "x".repeat(40);
const CREATOR = "kaspa:creator_wallet_aaaa";
const PART = "kaspa:participant_wallet_bbbb";
const OUTSIDER = "kaspa:outsider_wallet_cccc";
let server: Server | undefined;
afterEach(() => server?.close());

async function setup(now: () => number = Date.now) {
  const access = new MockHuntAccessStore();
  access.seedHunt({ huntId: "h_on", status: "activated" });
  access.seedHunt({ huntId: "h_other", status: "activated" });
  access.seedHunt({ huntId: "h_active", status: "active" });
  for (const id of ["h_on", "h_other", "h_active"]) {
    access.seedRole({ huntId: id, walletFingerprint: fingerprintWallet(CREATOR), role: "creator" });
    access.seedRole({
      huntId: id,
      walletFingerprint: fingerprintWallet(PART),
      role: "participant",
    });
  }
  const auth = new AuthService(SECRET, 900, now);
  const app = createApp({
    chat: new ChatService(new MemoryChatStore(), new MockMatrixService("https://matrix.test")),
    auth,
    access,
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
  const tokenFor = async (huntId: string, walletAddress: string) => {
    const r = await post("/api/auth/chat-access", { huntId, walletAddress });
    return { status: r.status, body: (await r.json()) as Record<string, unknown> };
  };
  return { post, get, tokenFor, auth };
}
const chatBody = (huntId: string) => ({
  huntId,
  huntName: "Test",
  expiresAt: Date.now() + 3_600_000,
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
    const fp = fingerprintWallet(CREATOR);
    for (const txt of texts.slice(1)) {
      expect(txt).not.toContain("roomId");
      expect(txt).not.toContain("!mock_");
    }
    for (const txt of texts) {
      expect(txt).not.toContain(fp);
      expect(txt).not.toContain(CREATOR);
    }
  });
});
