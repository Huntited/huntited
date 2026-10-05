import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearSession } from "./api-client";
import { ChatAccessError, obtainChatAccess, roleFromChatToken } from "./chat-access-api";

const CHALLENGE = { challengeId: "a".repeat(32), message: "Huntited wants you…", expiresAt: 1 };
const SESSION = { accessToken: "session-jwt", expiresAt: Date.now() + 3_600_000 };
const TOKEN = { accessToken: "chat-jwt", expiresAt: 2 };

interface Call {
  path: string;
  body: Record<string, unknown>;
  auth: string | undefined;
}

function mockFetch(responses: Record<string, { status: number; body: unknown }>) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      const path = url.slice(url.indexOf("/api/") + "/api/".length);
      const headers = init.headers as Record<string, string>;
      calls.push({
        path,
        body: JSON.parse(String(init.body ?? "{}")) as Record<string, unknown>,
        auth: headers["Authorization"],
      });
      const r = responses[path]!;
      return new Response(JSON.stringify(r.body), { status: r.status });
    }),
  );
  return calls;
}

beforeEach(() => clearSession());
afterEach(() => vi.unstubAllGlobals());

describe("obtainChatAccess", () => {
  it("signe le défi une fois, ouvre une session, puis demande le jeton de chat", async () => {
    const calls = mockFetch({
      "auth/challenge": { status: 200, body: CHALLENGE },
      "auth/session": { status: 200, body: SESSION },
      "auth/chat-access": { status: 200, body: TOKEN },
    });
    const sign = vi.fn(async (m: string) => `sig(${m})`);

    expect(await obtainChatAccess({ huntId: "h1", walletAddress: "kaspatest:q1", sign })).toEqual(
      TOKEN,
    );
    expect(sign).toHaveBeenCalledWith(CHALLENGE.message);
    expect(calls.map((c) => c.path)).toEqual([
      "auth/challenge",
      "auth/session",
      "auth/chat-access",
    ]);
    expect(calls[1]!.body).toEqual({
      walletAddress: "kaspatest:q1",
      challengeId: CHALLENGE.challengeId,
      signature: `sig(${CHALLENGE.message})`,
    });
    expect(calls[2]!.body).toEqual({ huntId: "h1" });
    expect(calls[2]!.auth).toBe("Bearer session-jwt");

    // Deuxième chasse : la session est réutilisée, aucune nouvelle signature.
    await obtainChatAccess({ huntId: "h2", walletAddress: "kaspatest:q1", sign });
    expect(sign).toHaveBeenCalledTimes(1);
    expect(calls.map((c) => c.path).slice(3)).toEqual(["auth/chat-access"]);

    // Autre wallet : nouvelle signature.
    await obtainChatAccess({ huntId: "h1", walletAddress: "kaspatest:q2", sign });
    expect(sign).toHaveBeenCalledTimes(2);
  });

  it("signature refusée dans le wallet : erreur dédiée, aucune session demandée", async () => {
    const calls = mockFetch({ "auth/challenge": { status: 200, body: CHALLENGE } });
    const sign = vi.fn(async () => {
      throw new Error("user rejected");
    });
    await expect(
      obtainChatAccess({ huntId: "h1", walletAddress: "kaspatest:q1", sign }),
    ).rejects.toMatchObject({ reason: "signature_refused" });
    expect(calls.map((c) => c.path)).toEqual(["auth/challenge"]);
  });

  it("signature rejetée par le serveur : accès refusé", async () => {
    mockFetch({
      "auth/challenge": { status: 200, body: CHALLENGE },
      "auth/session": { status: 401, body: { error: "Non autorisé." } },
    });
    const err = await obtainChatAccess({
      huntId: "h1",
      walletAddress: "kaspatest:q1",
      sign: async () => "sig",
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ChatAccessError);
    expect((err as ChatAccessError).reason).toBe("forbidden");
  });

  it("chat pas encore ouvert : not_ready", async () => {
    mockFetch({
      "auth/challenge": { status: 200, body: CHALLENGE },
      "auth/session": { status: 200, body: SESSION },
      "auth/chat-access": { status: 409, body: { error: "pas encore" } },
    });
    await expect(
      obtainChatAccess({ huntId: "h1", walletAddress: "kaspatest:q1", sign: async () => "s" }),
    ).rejects.toMatchObject({ reason: "not_ready" });
  });
});

describe("roleFromChatToken", () => {
  const jwtWith = (payload: object) =>
    `h.${btoa(JSON.stringify(payload)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_")}.s`;

  it("lit le rôle inscrit par le serveur", () => {
    expect(roleFromChatToken(jwtWith({ role: "creator" }))).toBe("creator");
    expect(roleFromChatToken(jwtWith({ role: "participant" }))).toBe("participant");
    expect(roleFromChatToken(jwtWith({ role: "admin" }))).toBeNull();
    expect(roleFromChatToken("pas-un-jwt")).toBeNull();
  });
});
