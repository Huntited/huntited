import { afterEach, describe, expect, it, vi } from "vitest";

import { ChatAccessError, obtainChatAccess } from "./chat-access-api";

const CHALLENGE = { challengeId: "a".repeat(32), message: "Huntited wants you…", expiresAt: 1 };
const TOKEN = { accessToken: "jwt", expiresAt: 2 };

function mockFetch(responses: Record<string, { status: number; body: unknown }>) {
  const calls: { path: string; body: Record<string, unknown> }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      const path = url.slice(url.indexOf("/api/auth/") + "/api/auth/".length);
      calls.push({ path, body: JSON.parse(String(init.body)) as Record<string, unknown> });
      const r = responses[path]!;
      return new Response(JSON.stringify(r.body), { status: r.status });
    }),
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("obtainChatAccess", () => {
  it("fait signer le message du serveur puis l'envoie avec le défi", async () => {
    const calls = mockFetch({
      challenge: { status: 200, body: CHALLENGE },
      "chat-access": { status: 200, body: TOKEN },
    });
    const sign = vi.fn(async (m: string) => `sig(${m})`);

    const token = await obtainChatAccess({ huntId: "h1", walletAddress: "kaspatest:q1", sign });

    expect(token).toEqual(TOKEN);
    expect(sign).toHaveBeenCalledWith(CHALLENGE.message);
    expect(calls.map((c) => c.path)).toEqual(["challenge", "chat-access"]);
    expect(calls[1]!.body).toEqual({
      huntId: "h1",
      walletAddress: "kaspatest:q1",
      challengeId: CHALLENGE.challengeId,
      signature: `sig(${CHALLENGE.message})`,
    });
  });

  it("signature refusée dans le wallet : erreur dédiée, rien n'est envoyé", async () => {
    const calls = mockFetch({ challenge: { status: 200, body: CHALLENGE } });
    const sign = vi.fn(async () => {
      throw new Error("user rejected");
    });

    await expect(
      obtainChatAccess({ huntId: "h1", walletAddress: "kaspatest:q1", sign }),
    ).rejects.toMatchObject({ reason: "signature_refused" });
    expect(calls.map((c) => c.path)).toEqual(["challenge"]);
  });

  it("signature rejetée par le serveur : accès refusé", async () => {
    mockFetch({
      challenge: { status: 200, body: CHALLENGE },
      "chat-access": { status: 401, body: { error: "Non autorisé." } },
    });
    const err = await obtainChatAccess({
      huntId: "h1",
      walletAddress: "kaspatest:q1",
      sign: async () => "sig",
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ChatAccessError);
    expect((err as ChatAccessError).reason).toBe("forbidden");
  });
});
