import { beforeEach, describe, expect, it } from "vitest";

import { qrSvg, roomIntent, roomLink } from "./app-link";
import { chatPublicKey, getChatKey, importChatKey } from "./p2p-chat";

const HUNT = "ab".repeat(12);
const KEY = "11".repeat(32);

beforeEach(() => localStorage.clear());

describe("liens vers l'app Huntited Chat", () => {
  it("lien web : la clé reste après « # » (jamais envoyée au serveur)", () => {
    const link = roomLink(HUNT, KEY);
    expect(link).toBe(`https://huntited.com/app/salon#${HUNT}.${KEY}`);
    expect(new URL(link).pathname).toBe("/app/salon");
    expect(() => roomLink("x", KEY)).toThrow();
  });

  it("lien Android : ouvre l'app, sinon la page d'installation (sans la clé)", () => {
    const intent = roomIntent(HUNT, KEY);
    expect(intent.startsWith(`intent://salon/${HUNT}/${KEY}#Intent;scheme=huntited;`)).toBe(true);
    expect(intent).toContain("package=com.huntited.chat");
    const fallback = decodeURIComponent(/S\.browser_fallback_url=([^;]+)/.exec(intent)![1]!);
    expect(fallback).toBe("https://huntited.com/app/");
  });

  it("QR code généré localement", () => {
    expect(qrSvg(roomLink(HUNT, KEY))).toMatch(/^<svg/);
  });

  it("le salon ouvert par lien enregistre la clé : même membre", () => {
    expect(importChatKey(HUNT, KEY)).toBe(true);
    expect(chatPublicKey(getChatKey(HUNT)!)).toBe(chatPublicKey(KEY));
    expect(importChatKey(HUNT, "zz")).toBe(false);
  });
});
