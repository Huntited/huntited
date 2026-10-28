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
  down: false,
}));

vi.mock("@/lib/onchain/browser-index", () => ({
  getChainChat: async () => ({ members: chain.members, deadline: chain.deadline }),
  getChainMemberDeeds: async () => ({}),
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
      if (relay.down) throw new Error("relays_timeout");
      relay.events.push(e);
    },
    close: () => undefined,
  }),
}));

beforeEach(() => {
  localStorage.clear();
  relay.events = [];
  relay.listeners = [];
  relay.down = false;
});
afterEach(() => cleanup());

describe("chat chiffré (sans serveur)", () => {
  it("un membre écrit et relit son message, chiffré sur le relais", async () => {
    const mine = ensureChatKey(HUNT)!;
    chain.members = [mine, "11".repeat(32)];
    render(<P2PChatPanel huntId={HUNT} title="Test" />);
    const box = await screen.findByRole("textbox", { name: "Écrire un message…" });
    fireEvent.change(box, { target: { value: "On se retrouve à 18 h" } });
    // Entrée envoie (Maj+Entrée irait à la ligne).
    fireEvent.keyDown(box, { key: "Enter" });
    // Affiché tout de suite, puis confirmé par le relais (l'heure remplace « Envoi… »).
    await waitFor(() => expect(relay.events).toHaveLength(1));
    await waitFor(() => expect(screen.queryByText("Envoi…")).toBeNull());
    const items = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(items.some((x) => x?.includes("On se retrouve à 18 h"))).toBe(true);
    expect((box as HTMLTextAreaElement).value).toBe("");
    expect(relay.events[0]!.content).not.toContain("18 h");
    expect(chatPublicKey(getChatKey(HUNT)!)).toBe(mine);
  });

  it("message non envoyé : le dit, et permet de réessayer", async () => {
    chain.members = [ensureChatKey(HUNT)!];
    render(<P2PChatPanel huntId={HUNT} title="Test" />);
    const box = await screen.findByRole("textbox", { name: "Écrire un message…" });
    relay.down = true;
    fireEvent.change(box, { target: { value: "Coucou" } });
    fireEvent.keyDown(box, { key: "Enter" });
    const retry = await screen.findByRole("button", { name: "Réessayer" });
    expect(screen.getByText(/Non envoyé/)).toBeTruthy();
    relay.down = false;
    fireEvent.click(retry);
    await waitFor(() => expect(relay.events).toHaveLength(1));
    await waitFor(() => expect(screen.queryByText(/Non envoyé/)).toBeNull());
  });

  it("plan B : le pseudo bitchat partagé est chiffré et listé pour les membres", async () => {
    chain.members = [ensureChatKey(HUNT)!];
    render(<P2PChatPanel huntId={HUNT} title="Test" />);
    await screen.findByRole("textbox", { name: "Écrire un message…" });
    fireEvent.click(screen.getByText("Plan B si le réseau coupe (bitchat)"));
    fireEvent.change(screen.getByRole("textbox", { name: "Ton pseudo bitchat" }), {
      target: { value: "renard42" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Partager avec les membres" }));
    await waitFor(() => expect(relay.events).toHaveLength(1));
    expect(relay.events[0]!.content).not.toContain("renard42");
    await waitFor(() => expect(screen.getAllByText("renard42").length).toBeGreaterThan(0));
    expect(screen.getByText(/#bluetooth est public/)).toBeTruthy();
  });

  it("refuse une personne qui n'est pas membre", async () => {
    ensureChatKey(HUNT);
    chain.members = ["11".repeat(32)];
    render(<P2PChatPanel huntId={HUNT} title="Test" />);
    await waitFor(() => expect(screen.getByText(/réservé aux personnes engagées/)).toBeTruthy());
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("sans clé dans ce navigateur : explique où ouvrir le chat", async () => {
    chain.members = ["11".repeat(32)];
    render(<P2PChatPanel huntId={HUNT} title="Test" />);
    await waitFor(() => expect(screen.getByText(/pas la clé du salon/)).toBeTruthy());
  });
});
