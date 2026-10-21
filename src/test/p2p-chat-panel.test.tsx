import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { P2PChatPanel } from "@/components/hunt/P2PChatPanel";
import type { NostrEvent } from "@/lib/p2p-chat";
import { chatPublicKey, ensureChatKey, getChatKey } from "@/lib/p2p-chat";

const HUNT = "ab".repeat(12);
const chain = vi.hoisted(() => ({
  members: [] as string[],
  deadline: Date.now() + 86_400_000,
}));
// Un seul « relais » partagé, en mémoire.
const relay = vi.hoisted(() => ({
  events: [] as NostrEvent[],
  listeners: [] as ((e: NostrEvent) => void)[],
}));

vi.mock("@/lib/onchain/browser-index", () => ({
  getChainChat: async () => ({ members: chain.members, deadline: chain.deadline }),
}));
vi.mock("@/lib/nostr-relays", () => ({
  nostrRelays: () => ["wss://test"],
  createRelayPool: () => ({
    subscribe: (_f: unknown, on: (e: NostrEvent) => void) => {
      relay.events.forEach(on);
      relay.listeners.push(on);
      return () => undefined;
    },
    publish: async (e: NostrEvent) => {
      relay.events.push(e);
    },
    close: () => undefined,
  }),
}));

beforeEach(() => {
  localStorage.clear();
  relay.events = [];
  relay.listeners = [];
});
afterEach(() => cleanup());

describe("chat chiffré (sans serveur)", () => {
  it("un membre écrit et relit son message, chiffré sur le relais", async () => {
    const mine = ensureChatKey(HUNT)!;
    chain.members = [mine, "11".repeat(32)];
    render(<P2PChatPanel huntId={HUNT} />);
    const box = await screen.findByRole("textbox");
    fireEvent.change(box, { target: { value: "On se retrouve à 18 h" } });
    fireEvent.click(screen.getByRole("button", { name: "Envoyer" }));
    // Le message apparaît dans la liste, signé « Toi ».
    expect(await screen.findByText(/^Toi ·/)).toBeTruthy();
    const items = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(items.some((x) => x?.includes("On se retrouve à 18 h"))).toBe(true);
    expect(relay.events).toHaveLength(1);
    expect(relay.events[0]!.content).not.toContain("18 h");
    expect(chatPublicKey(getChatKey(HUNT)!)).toBe(mine);
  });

  it("refuse une personne qui n'est pas membre", async () => {
    ensureChatKey(HUNT);
    chain.members = ["11".repeat(32)];
    render(<P2PChatPanel huntId={HUNT} />);
    await waitFor(() => expect(screen.getByText(/réservé aux personnes engagées/)).toBeTruthy());
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("sans clé dans ce navigateur : explique où ouvrir le chat", async () => {
    chain.members = ["11".repeat(32)];
    render(<P2PChatPanel huntId={HUNT} />);
    await waitFor(() => expect(screen.getByText(/pas de clé de chat/)).toBeTruthy());
  });
});
