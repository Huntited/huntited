// Outils de test : application réelle sur port éphémère + vrais wallets Schnorr.
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { schnorr } from "@noble/curves/secp256k1.js";
import { bytesToHex } from "@noble/hashes/utils.js";

import { createApp } from "./app.js";
import { AuthService } from "./services/auth-service.js";
import { ChallengeService } from "./services/challenge-service.js";
import { ChatService } from "./services/chat-service.js";
import { MemoryChatStore } from "./services/chat-store.js";
import { HuntRegistry } from "./services/hunt-registry.js";
import { encodeKaspaAddress, personalMessageHash } from "./services/kaspa-signature.js";
import { MockMatrixService } from "./services/matrix-service.js";
import { PassRegistry } from "./services/pass-registry.js";
import type { PushService } from "./services/push-service.js";
import type { ChainIndexer } from "./chain/indexer.js";
import { createSignatureVerifier } from "./services/wallet-auth.js";

export interface TestWallet {
  address: string;
  secret: Uint8Array;
}

export function makeWallet(prefix = "kaspatest"): TestWallet {
  const secret = schnorr.utils.randomSecretKey();
  return { secret, address: encodeKaspaAddress(prefix, 0, schnorr.getPublicKey(secret)) };
}

export const signWith = (w: TestWallet, message: string) =>
  bytesToHex(schnorr.sign(personalMessageHash(message), w.secret));

export const SECRET = "x".repeat(40);

export async function startApp(
  opts: {
    now?: () => number;
    registry?: HuntRegistry;
    /** Seuil minimum ; 1 par défaut (petits scénarios), "default" = règle réelle. */
    minThreshold?: number | "default";
    /** Pass Huntited activés (invitations de départ, pass exigé ou non). */
    passes?: { required: boolean; genesis?: string[] };
    /** Notifications « me prévenir » (expéditeur factice). */
    push?: PushService;
    /** Conseil « compte dédié » (API factice). */
    walletCheck?: { apiUrl: string; fetch: typeof fetch };
    /** Index du registre sur la chaîne (réseau simulé). */
    chain?: { indexer: ChainIndexer; registryAddress: string };
  } = {},
) {
  const now = opts.now ?? Date.now;
  const passes = opts.passes
    ? new PassRegistry({ now, genesisInvites: opts.passes.genesis ?? [] })
    : undefined;
  const registry = opts.registry ?? new HuntRegistry({ now });
  const auth = new AuthService(SECRET, 900, now, 3600);
  const app = createApp({
    chat: new ChatService(new MemoryChatStore(), new MockMatrixService("https://matrix.test")),
    auth,
    registry,
    challenges: new ChallengeService({ appUri: "http://localhost", network: "testnet-10", now }),
    verifySignature: createSignatureVerifier("signature", "testnet-10"),
    corsOrigin: "http://localhost",
    nodeEnv: "test",
    now,
    ...(opts.minThreshold === "default" ? {} : { minThreshold: opts.minThreshold ?? 1 }),
    ...(passes
      ? { passes: { registry: passes, required: opts.passes!.required, invitesPerMonth: 3 } }
      : {}),
    ...(opts.push ? { push: { service: opts.push, publicKey: "test-public-key" } } : {}),
    ...(opts.walletCheck ? { walletCheck: opts.walletCheck } : {}),
    ...(opts.chain ? { chain: opts.chain } : {}),
  });
  const server: Server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const request = async (method: "GET" | "POST", path: string, body?: unknown, token?: string) => {
    const r = await fetch(base + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await r.text();
    return {
      status: r.status,
      text,
      body: (text ? JSON.parse(text) : {}) as Record<string, unknown>,
    };
  };
  const post = (path: string, body?: unknown, token?: string) =>
    request("POST", path, body ?? {}, token);
  const get = (path: string, token?: string) => request("GET", path, undefined, token);

  /** Défi → signature → jeton de session. */
  const login = async (w: TestWallet) => {
    const c = await post("/api/auth/challenge", { walletAddress: w.address });
    const s = await post("/api/auth/session", {
      walletAddress: w.address,
      challengeId: c.body["challengeId"],
      signature: signWith(w, c.body["message"] as string),
    });
    return s.body["accessToken"] as string;
  };

  const createHunt = (token: string, over: Record<string, unknown> = {}) =>
    post(
      "/api/hunts",
      {
        title: "Chasse",
        description: "Description",
        location: "Lieu",
        deadline: new Date(now() + 86_400_000).toISOString(),
        threshold: 2,
        ...over,
      },
      token,
    );

  return { server, registry, auth, passes, post, get, login, createHunt };
}
