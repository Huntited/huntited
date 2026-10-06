// Adaptateur Synapse, contre un faux serveur qui enregistre les appels.
import { describe, expect, it } from "vitest";

import { ChatService } from "./chat-service.js";
import { MemoryChatStore } from "./chat-store.js";
import { MatrixError, SynapseMatrixService } from "./matrix-service.js";

const TOKEN = "syt_secret_admin_token";

function fakeSynapse(fail?: string) {
  const calls: { method: string; path: string; body: Record<string, unknown>; auth: string }[] = [];
  const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
    const u = new URL(String(url));
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    const auth = new Headers(init?.headers).get("authorization") ?? "";
    calls.push({ method: init?.method ?? "GET", path: decodeURIComponent(u.pathname), body, auth });
    if (fail && u.pathname.includes(fail)) return new Response("{}", { status: 500 });
    if (u.pathname.endsWith("/createRoom")) {
      return Response.json({ room_id: "!room123:huntited.test" });
    }
    return Response.json({});
  }) as typeof fetch;
  const synapse = new SynapseMatrixService({
    homeserverUrl: "https://matrix.huntited.test",
    serverName: "huntited.test",
    accessToken: TOKEN,
    clientUrl: "https://chat.huntited.test",
    fetch: fetchImpl,
  });
  return { synapse, calls };
}

describe("Synapse", () => {
  it("crée un salon privé, non fédéré, chiffré de bout en bout", async () => {
    const { synapse, calls } = fakeSynapse();
    const room = await synapse.createPrivateRoom({
      huntId: "h1",
      huntName: "Rassemblement",
      expiresAt: Date.now() + 1000,
    });
    expect(room).toEqual({
      roomId: "!room123:huntited.test",
      inviteLink: "https://chat.huntited.test/#/room/!room123%3Ahuntited.test",
    });
    const create = calls[0]!;
    expect(create.auth).toBe(`Bearer ${TOKEN}`);
    expect(create.body).toMatchObject({
      preset: "private_chat",
      visibility: "private",
      creation_content: { "m.federate": false },
    });
    const state = create.body["initial_state"] as { type: string; content: unknown }[];
    expect(state).toContainEqual(
      expect.objectContaining({
        type: "m.room.encryption",
        content: { algorithm: "m.megolm.v1.aes-sha2" },
      }),
    );
    expect(state).toContainEqual(
      expect.objectContaining({
        type: "m.room.history_visibility",
        content: { history_visibility: "joined" },
      }),
    );
  });

  it("chaque personne a son compte temporaire, réutilisé, puis tout est supprimé", async () => {
    const { synapse, calls } = fakeSynapse();
    const chat = new ChatService(new MemoryChatStore(), synapse);
    const input = { huntId: "h1", huntName: "Rassemblement", expiresAt: Date.now() + 60_000 };
    const creator = { key: "k-creator", role: "creator" as const };
    const alice = { key: "k-alice", role: "participant" as const };

    const c = await chat.createChat(input, creator);
    const a1 = await chat.getChatStatus("h1", alice);
    const a2 = await chat.getChatStatus("h1", alice);

    // Identifiants temporaires, propres à chaque personne, sans lien avec le wallet.
    expect(c.login?.username).toMatch(/^@h[0-9a-f]{16}:huntited\.test$/);
    expect(a1.login?.username).toMatch(/^@h[0-9a-f]{16}:huntited\.test$/);
    expect(a1.login?.username).not.toBe(c.login?.username);
    // Même compte au retour, nouveau mot de passe.
    expect(a2.login?.username).toBe(a1.login?.username);
    expect(a2.login?.password).not.toBe(a1.login?.password);
    expect(a1.login?.clientUrl).toBe("https://chat.huntited.test");

    const users = calls.filter((x) => x.path.startsWith("/_synapse/admin/v2/users/"));
    expect(users.map((u) => u.body["displayname"])).toEqual([
      "Créateur·rice",
      "Participant·e 2",
      "Participant·e 2",
    ]);
    expect(calls.filter((x) => x.path.startsWith("/_synapse/admin/v1/join/"))).toHaveLength(3);

    // Expiration : salon supprimé (purgé, bloqué), comptes désactivés et effacés.
    expect(await chat.cleanExpiredChats(Date.now() + 120_000)).toBe(1);
    const del = calls.find((x) => x.method === "DELETE")!;
    expect(del.path).toBe("/_synapse/admin/v2/rooms/!room123:huntited.test");
    expect(del.body).toEqual({ block: true, purge: true });
    const deactivated = calls.filter((x) => x.path.startsWith("/_synapse/admin/v1/deactivate/"));
    expect(deactivated.map((d) => d.path.split("/").pop())).toEqual([
      c.login!.username,
      a1.login!.username,
    ]);
    expect(deactivated.every((d) => d.body["erase"] === true)).toBe(true);
  });

  it("une erreur ne révèle ni token, ni salon, ni compte", async () => {
    const { synapse } = fakeSynapse("/join/");
    const err = await synapse
      .grantAccess("!room123:huntited.test", { displayName: "x" })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MatrixError);
    const message = (err as Error).message;
    expect(message).toBe("matrix_join_failed");
    expect(message).not.toContain(TOKEN);
    expect(message).not.toContain("room123");
  });
});
