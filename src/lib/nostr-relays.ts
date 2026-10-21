// Connexion minimale à des relais Nostr (NIP-01), pour le chat chiffré.
// Plusieurs relais à la fois : un message est envoyé à tous, et lu sur tous
// (doublons écartés). Les relais ne voient que des messages chiffrés.
import type { NostrEvent } from "./p2p-chat";

/** Relais publics par défaut (VITE_NOSTR_RELAYS pour les remplacer, séparés par des virgules). */
const DEFAULT_RELAYS = ["wss://relay.damus.io", "wss://nos.lol", "wss://relay.primal.net"];

export function nostrRelays(): string[] {
  const raw = import.meta.env["VITE_NOSTR_RELAYS"] as string | undefined;
  const list = (raw ?? "")
    .split(",")
    .map((u) => u.trim())
    .filter((u) => /^wss?:\/\//.test(u));
  return list.length ? list : DEFAULT_RELAYS;
}

export interface NostrFilter {
  kinds: number[];
  "#h": string[];
  since?: number;
}

export interface RelayPool {
  /** Reçoit les événements correspondants (anciens puis nouveaux) ; renvoie de quoi arrêter. */
  subscribe(filter: NostrFilter, onEvent: (e: NostrEvent) => void): () => void;
  /** Envoie à tous les relais ; résolu dès qu'un relais l'accepte. */
  publish(e: NostrEvent): Promise<void>;
  close(): void;
}

type Socket = Pick<WebSocket, "send" | "close" | "readyState"> & {
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: ((ev: unknown) => void) | null;
  onerror: ((ev: unknown) => void) | null;
};
export type SocketFactory = (url: string) => Socket;

const OPEN = 1;
const PUBLISH_TIMEOUT_MS = 10_000;
const RECONNECT_MS = 5_000;

export function createRelayPool(
  urls: string[],
  open: SocketFactory = (url) => new WebSocket(url) as unknown as Socket,
): RelayPool {
  const subs = new Map<string, { filter: NostrFilter; onEvent: (e: NostrEvent) => void }>();
  const okWaiters = new Map<string, (accepted: boolean) => void>();
  const seen = new Set<string>();
  let closed = false;
  let n = 0;

  const relays = urls.map((url) => {
    const relay = { url, socket: null as Socket | null, queue: [] as string[] };
    const connect = () => {
      if (closed) return;
      const s = open(url);
      relay.socket = s;
      s.onopen = () => {
        for (const [id, sub] of subs) s.send(JSON.stringify(["REQ", id, sub.filter]));
        for (const m of relay.queue.splice(0)) s.send(m);
      };
      s.onmessage = (ev) => {
        let msg: unknown;
        try {
          msg = JSON.parse(String(ev.data));
        } catch {
          return;
        }
        if (!Array.isArray(msg)) return;
        if (msg[0] === "EVENT" && typeof msg[1] === "string" && msg[2]) {
          const e = msg[2] as NostrEvent;
          if (typeof e.id !== "string" || seen.has(e.id)) return;
          seen.add(e.id);
          subs.get(msg[1])?.onEvent(e);
        } else if (msg[0] === "OK" && typeof msg[1] === "string") {
          okWaiters.get(msg[1])?.(msg[2] === true);
        }
      };
      s.onerror = () => undefined;
      s.onclose = () => {
        relay.socket = null;
        if (!closed && subs.size > 0) setTimeout(connect, RECONNECT_MS);
      };
    };
    const send = (m: string) => {
      if (relay.socket?.readyState === OPEN) relay.socket.send(m);
      else {
        relay.queue.push(m);
        if (!relay.socket) connect();
      }
    };
    return { relay, send };
  });

  return {
    subscribe(filter, onEvent) {
      const id = `h${++n}`;
      subs.set(id, { filter, onEvent });
      for (const r of relays) r.send(JSON.stringify(["REQ", id, filter]));
      return () => {
        subs.delete(id);
        for (const r of relays)
          if (r.relay.socket?.readyState === OPEN) r.send(JSON.stringify(["CLOSE", id]));
      };
    },
    publish(e) {
      seen.add(e.id); // déjà affiché par l'expéditeur
      return new Promise<void>((resolve, reject) => {
        let pending = relays.length;
        const done = (accepted: boolean) => {
          if (accepted) {
            okWaiters.delete(e.id);
            clearTimeout(timer);
            resolve();
          } else if (--pending <= 0) {
            okWaiters.delete(e.id);
            clearTimeout(timer);
            reject(new Error("relays_refused"));
          }
        };
        const timer = setTimeout(() => {
          okWaiters.delete(e.id);
          reject(new Error("relays_timeout"));
        }, PUBLISH_TIMEOUT_MS);
        okWaiters.set(e.id, done);
        for (const r of relays) r.send(JSON.stringify(["EVENT", e]));
      });
    },
    close() {
      closed = true;
      subs.clear();
      for (const r of relays) r.relay.socket?.close();
    },
  };
}
