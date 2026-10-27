import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  disableChatNotify,
  enableChatNotify,
  followedChats,
  isChatNotifyOn,
  setVisibleChat,
  shouldNotify,
  showChatNotification,
} from "./chat-notify";

const HUNT = "ab".repeat(12);
const shown: { title: string; options: NotificationOptions }[] = [];

beforeEach(() => {
  localStorage.clear();
  shown.length = 0;
  class FakeNotification {
    static permission: NotificationPermission = "default";
    static requestPermission = vi.fn(async () => {
      FakeNotification.permission = "granted";
      return "granted" as const;
    });
    onclick: (() => void) | null = null;
    constructor(title: string, options: NotificationOptions) {
      shown.push({ title, options });
    }
    close() {}
  }
  vi.stubGlobal("Notification", FakeNotification);
});
afterEach(() => vi.unstubAllGlobals());

describe("notifications du chat", () => {
  it("activées après l'accord du navigateur, puis désactivables", async () => {
    expect(await enableChatNotify(HUNT, "Conseil municipal")).toBe("on");
    expect(isChatNotifyOn(HUNT)).toBe(true);
    expect(followedChats()).toEqual({ [HUNT]: "Conseil municipal" });
    disableChatNotify(HUNT);
    expect(isChatNotifyOn(HUNT)).toBe(false);
  });

  it("refusées par le navigateur : rien n'est suivi", async () => {
    (Notification as unknown as { requestPermission: () => Promise<string> }).requestPermission =
      async () => "denied";
    expect(await enableChatNotify(HUNT, "x")).toBe("denied");
    expect(followedChats()).toEqual({});
  });

  it("ne montre jamais le texte du message, seulement l'action", async () => {
    await enableChatNotify(HUNT, "Conseil municipal");
    await showChatNotification(HUNT, "Conseil municipal", "https://huntited.test/", () => {});
    expect(shown).toHaveLength(1);
    expect(shown[0]!.title).toBe("Nouveau message");
    expect(shown[0]!.options.body).toBe("Dans le chat de « Conseil municipal »");
  });

  it("pas de notification pour le chat affiché à l'écran", () => {
    setVisibleChat(HUNT);
    expect(shouldNotify(HUNT)).toBe(false);
    expect(shouldNotify("cd".repeat(12))).toBe(true);
    setVisibleChat(null);
    expect(shouldNotify(HUNT)).toBe(true);
  });
});
