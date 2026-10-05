import { describe, expect, it } from "vitest";

import { ChatService } from "./chat-service.js";
import { MemoryChatStore } from "./chat-store.js";
import { MockMatrixService } from "./matrix-service.js";

function setup(start = 1_000_000) {
  let now = start;
  const store = new MemoryChatStore();
  const service = new ChatService(store, new MockMatrixService("https://matrix.test"), () => now);
  return { service, store, advance: (ms: number) => (now += ms) };
}
const input = { huntId: "hunt_1", huntName: "Test", expiresAt: 1_000_000 + 60_000 };

describe("ChatService", () => {
  it("crée un chat actif", async () => {
    const { service } = setup();
    const res = await service.createChat(input);
    expect(res.isActive).toBe(true);
    expect(res.inviteLink).toMatch(/^https:\/\/matrix\.test/);
  });

  it("idempotent pour une même hunt", async () => {
    const { service, store } = setup();
    const a = await service.createChat(input);
    const b = await service.createChat(input);
    expect(a).toEqual(b);
    expect(store.all()).toHaveLength(1);
  });

  it("l'expiration ferme et retire le chat", async () => {
    const { service, store, advance } = setup();
    await service.createChat(input);
    advance(61_000);
    expect((await service.getChatStatus("hunt_1")).isActive).toBe(false);
    expect(store.get("hunt_1")).toBeUndefined();
  });

  it("cleanExpiredChats retire les salons expirés", async () => {
    const { service, store, advance } = setup();
    await service.createChat(input);
    advance(61_000);
    expect(await service.cleanExpiredChats()).toBe(1);
    expect(store.all()).toHaveLength(0);
  });

  it("rejette un expiresAt passé", async () => {
    const { service } = setup();
    await expect(service.createChat({ ...input, expiresAt: 1 })).rejects.toThrow();
  });

  it("la réponse publique ne contient jamais roomId", async () => {
    const { service } = setup();
    const created = await service.createChat(input);
    const status = await service.getChatStatus("hunt_1");
    for (const r of [created, status]) {
      expect(Object.keys(r)).not.toContain("roomId");
      expect(JSON.stringify(r)).not.toContain("!mock_");
    }
  });
});
