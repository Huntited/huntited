// Messages des salons par Bluetooth, dans l'app Huntited Chat (docs/app.md).
//
// L'app relaie nos événements Nostr (déjà signés et chiffrés) de téléphone en
// téléphone par le mesh Bluetooth de bitchat, sans internet. Ici, la page :
// - envoie chaque message aux relais ET au mesh ;
// - reçoit ceux du mesh comme s'ils venaient d'un relais ;
// - renvoie aux relais les messages reçus par le mesh : les relais en attente
//   les envoient dès qu'internet revient, pour ceux qui sont loin.
// Hors de l'app, rien ne change.
import type { NostrFilter, RelayPool } from "./nostr-relays";
import { verifyEvent, type NostrEvent } from "./p2p-chat";

interface MeshApp {
  meshAvailable?: () => boolean;
  meshSend?: (json: string) => boolean;
  meshRecent?: () => string;
}

type MeshWindow = { HuntitedApp?: MeshApp; __huntitedMesh?: (json: string) => void };

function app(): MeshApp | null {
  if (typeof window === "undefined") return null;
  const a = (window as unknown as MeshWindow).HuntitedApp;
  return a && typeof a.meshSend === "function" ? a : null;
}

/** Le mesh Bluetooth de l'app est disponible. */
export function meshAvailable(): boolean {
  try {
    return app()?.meshAvailable?.() === true;
  } catch {
    return false;
  }
}

const matches = (f: NostrFilter, e: NostrEvent) =>
  f.kinds.includes(e.kind) &&
  e.tags.some((t) => t[0] === "h" && f["#h"].includes(t[1] ?? "")) &&
  (f.since === undefined || e.created_at >= f.since);

function parse(raw: unknown): NostrEvent | null {
  try {
    const e = (typeof raw === "string" ? JSON.parse(raw) : raw) as NostrEvent;
    return typeof e?.id === "string" && Array.isArray(e.tags) && verifyEvent(e) ? e : null;
  } catch {
    return null;
  }
}

/** Pages abonnées aux messages du mesh (l'app appelle window.__huntitedMesh). */
const listeners = new Set<(e: NostrEvent) => void>();

function listen(fn: (e: NostrEvent) => void): () => void {
  const w = window as unknown as MeshWindow;
  w.__huntitedMesh ??= (json) => {
    const e = parse(json);
    if (e) for (const l of listeners) l(e);
  };
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Ajoute le mesh Bluetooth à un groupe de relais (sans effet hors de l'app). */
export function withMesh(pool: RelayPool): RelayPool {
  const a = app();
  if (!a) return pool;

  const subs = new Set<{ filter: NostrFilter; onEvent: (e: NostrEvent) => void }>();
  const seen = new Set<string>();
  const once = (e: NostrEvent, then: () => void) => {
    if (seen.has(e.id)) return;
    seen.add(e.id);
    then();
  };
  const stopMesh = listen((e) => {
    const wanted = [...subs].filter((s) => matches(s.filter, e));
    if (wanted.length === 0) return;
    once(e, () => {
      for (const s of wanted) s.onEvent(e);
      void pool.publish(e).catch(() => undefined); // vers internet, dès qu'il revient
    });
  });

  return {
    subscribe(filter, onEvent) {
      const sub = { filter, onEvent };
      subs.add(sub);
      const stop = pool.subscribe(filter, (e) => once(e, () => onEvent(e)));
      // Rattrape ce que le mesh a reçu pendant que la page était fermée.
      try {
        const recent = JSON.parse(a.meshRecent?.() ?? "[]") as unknown;
        if (Array.isArray(recent))
          for (const raw of recent) {
            const e = parse(raw);
            if (e && matches(filter, e))
              once(e, () => {
                onEvent(e);
                void pool.publish(e).catch(() => undefined);
              });
          }
      } catch {
        /* rien en mémoire */
      }
      return () => {
        subs.delete(sub);
        stop();
      };
    },
    publish(e) {
      seen.add(e.id);
      let viaMesh = false;
      try {
        viaMesh = a.meshSend?.(JSON.stringify(e)) === true;
      } catch {
        viaMesh = false;
      }
      const relays = pool.publish(e);
      if (!viaMesh) return relays;
      // Parti par Bluetooth : envoyé, même si les relais attendent internet.
      void relays.catch(() => undefined);
      return Promise.resolve();
    },
    close() {
      stopMesh();
      subs.clear();
      pool.close();
    },
  };
}
