// Salons persistants : un redémarrage n'empêche pas leur fermeture.
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ChatService } from "./chat-service.js";
import { FileChatStore } from "./chat-store.js";
import { MockMatrixService } from "./matrix-service.js";

let dir: string | undefined;
afterEach(() => dir && rmSync(dir, { recursive: true, force: true }));

describe("FileChatStore", () => {
  it("retrouve les salons après un redémarrage et les ferme à l'expiration", async () => {
    dir = mkdtempSync(join(tmpdir(), "huntited-chat-"));
    const file = join(dir, "chats.json");
    let now = 1_000_000;

    const before = new ChatService(
      new FileChatStore(file),
      new MockMatrixService("https://m.test"),
      () => now,
    );
    await before.createChat(
      { huntId: "h1", huntName: "Chasse", expiresAt: now + 60_000 },
      { key: "k1", role: "creator" },
    );
    // Aucun wallet ni mot de passe dans le fichier.
    expect(readFileSync(file, "utf8")).not.toMatch(/password|kaspa/i);

    // « Redémarrage » : nouveau service, même fichier.
    const matrix = new MockMatrixService("https://m.test");
    const close = vi.spyOn(matrix, "closeRoom");
    const after = new ChatService(new FileChatStore(file), matrix, () => now);
    expect((await after.getChatStatus("h1")).isActive).toBe(true);

    now += 60_001;
    expect(await after.cleanExpiredChats()).toBe(1);
    expect(close).toHaveBeenCalledTimes(1);
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual([]);
  });
});
