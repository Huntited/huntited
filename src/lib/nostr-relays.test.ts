import { describe, expect, it } from "vitest";

import { createRelayPool, type SocketFactory } from "./nostr-relays";
import type { NostrEvent } from "./p2p-chat";

/** Faux relais : garde les événements reçus, répond OK (ou refuse). */
function fakeRelays(accept: Record<string, boolean>) {
  const stored: NostrEvent[] = [];
  const sent: string[] = [];
  const sockets: Record<string, { onmessage: ((ev: { data: unknown }) => void) | null }> = {};
  const factory: SocketFactory = (url) => {
    const s = {
      readyState: 0,
      onopen: null as ((ev: unknown) => void) | null,
      onmessage: null as ((ev: { data: unknown }) => void) | null,
      onclose: null as ((ev: unknown) => void) | null,
      onerror: null as ((ev: unknown) => void) | null,
      send(raw: string) {
        sent.push(`${url} ${raw}`);
        const msg = JSON.parse(raw) as unknown[];
        const reply = (m: unknown) =>
          queueMicrotask(() => s.onmessage?.({ data: JSON.stringify(m) }));
        if (msg[0] === "EVENT") {
          const e = msg[1] as NostrEvent;
          if (accept[url]) stored.push(e);
          reply(["OK", e.id, accept[url], ""]);
        } else if (msg[0] === "REQ") {
          for (const e of stored) reply(["EVENT", msg[1], e]);
          reply(["EOSE", msg[1]]);
        }
      },
      close() {},
    };
    sockets[url] = s;
    queueMicrotask(() => {
      s.readyState = 1;
      s.onopen?.({});
    });
    return s;
  };
  return { factory, stored, sent, sockets };
}

const ev = (id: string): NostrEvent => ({
  id,
  pubkey: "p",
  created_at: 1,
  kind: 4242,
  tags: [],
  content: "",
  sig: "s",
});
const tick = () => new Promise((r) => setTimeout(r, 0));

describe("relais Nostr", () => {
  it("envoie à tous les relais ; réussit si l'un accepte", async () => {
    const r = fakeRelays({ "wss://a": false, "wss://b": true });
    const pool = createRelayPool(["wss://a", "wss://b"], r.factory);
    await pool.publish(ev("1"));
    expect(r.sent.filter((s) => s.includes('"EVENT"'))).toHaveLength(2);
    pool.close();
  });

  it("échoue si tous refusent", async () => {
    const r = fakeRelays({ "wss://a": false, "wss://b": false });
    const pool = createRelayPool(["wss://a", "wss://b"], r.factory);
    await expect(pool.publish(ev("1"))).rejects.toThrow("relays_refused");
    pool.close();
  });

  it("lit les messages sur tous les relais, sans doublon", async () => {
    const r = fakeRelays({ "wss://a": true, "wss://b": true });
    const writer = createRelayPool(["wss://a", "wss://b"], r.factory);
    await writer.publish(ev("1"));
    await tick();
    const got: string[] = [];
    const reader = createRelayPool(["wss://a", "wss://b"], r.factory);
    reader.subscribe({ kinds: [4242], "#h": ["x"] }, (e) => got.push(e.id));
    await tick();
    await tick();
    expect(got).toEqual(["1"]);
    reader.close();
    writer.close();
  });
});
