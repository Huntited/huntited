// Messages des salons par Bluetooth, dans l'app Huntited Chat (docs/app.md).
//
// L'app relaie nos événements Nostr (déjà signés et chiffrés) de téléphone en
// téléphone par le mesh Bluetooth de bitchat, sans internet. Ici, la page :
// - envoie chaque message aux relais ET au mesh ;
// - reçoit ceux du mesh comme s'ils venaient d'un relais ;
// - renvoie aux relais les messages reçus par le mesh : les relais en attente
//   les envoient dès qu'internet revient, pour ceux qui sont loin.
// Hors de l'app, rien ne change.
//
// Confidentialité : sur le Bluetooth, n'importe quel téléphone à portée voit
// passer les paquets. Un message de salon y part donc dans une enveloppe,
// chiffrée en entier avec la clé commune des membres (la clé de présence,
// src/lib/presence.ts) : ni auteur ni salon visibles, une étiquette qui change
// chaque heure. Tant que le salon n'a pas cette clé, ses messages ne passent
// que par internet.
import { hkdf } from "@noble/hashes/hkdf.js";
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";

import type { NostrFilter, RelayPool } from "./nostr-relays";
import { CHAT_KIND, verifyEvent, type NostrEvent } from "./p2p-chat";

// --- Enveloppes (messages de salon sur le Bluetooth) ---

interface RoomKey {
  /** Clé d'enveloppe (dérivée de la clé de présence). */
  key: Uint8Array;
}

/** Clés d'enveloppe par salon (étiquette « h » du salon). */
const roomKeys = new Map<string, RoomKey>();

/** Le salon a sa clé commune : ses messages peuvent passer par Bluetooth, sous enveloppe. */
export function setMeshRoomKey(roomTopic: string, presenceKeyHex: string): void {
  const key = hkdf(
    sha256,
    hexToBytes(presenceKeyHex),
    undefined,
    utf8ToBytes("huntited-mesh-envelope-v1"),
    32,
  );
  roomKeys.set(roomTopic, { key });
}

const HOUR = 3_600_000;
const tagFor = (key: Uint8Array, hour: number) =>
  bytesToHex(hmac(sha256, key, utf8ToBytes(`huntited-mesh-topic|${hour}`)));

const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function aes(key: Uint8Array, usage: "encrypt" | "decrypt"): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", key as BufferSource, "AES-GCM", false, [usage]);
}

/** Enveloppe d'un message de salon (null si le salon n'a pas encore sa clé). */
export async function sealForMesh(e: NostrEvent, now = Date.now()): Promise<string | null> {
  const topic = e.tags.find((t) => t[0] === "h")?.[1];
  const room = topic ? roomKeys.get(topic) : undefined;
  if (!room) return null;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      await aes(room.key, "encrypt"),
      utf8ToBytes(JSON.stringify(e)),
    ),
  );
  return JSON.stringify({
    e: 1,
    h: tagFor(room.key, Math.floor(now / HOUR)),
    c: b64(new Uint8Array([...iv, ...ct])),
  });
}

/** Ouvre une enveloppe avec la clé d'un de nos salons ; null si elle n'est pas pour nous. */
export async function openFromMesh(
  env: { h?: unknown; c?: unknown },
  now = Date.now(),
): Promise<NostrEvent | null> {
  if (typeof env.h !== "string" || typeof env.c !== "string") return null;
  const hour = Math.floor(now / HOUR);
  for (const room of roomKeys.values()) {
    if (![hour, hour - 1, hour + 1].some((h) => tagFor(room.key, h) === env.h)) continue;
    try {
      const raw = unb64(env.c);
      const plain = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: raw.slice(0, 12) },
        await aes(room.key, "decrypt"),
        raw.slice(12),
      );
      return parse(new TextDecoder().decode(plain));
    } catch {
      return null;
    }
  }
  return null;
}

/** Événement reçu du mesh : en clair (demandes de place) ou sous enveloppe (salons). */
async function fromMesh(raw: unknown): Promise<NostrEvent | null> {
  try {
    const obj = (typeof raw === "string" ? JSON.parse(raw) : raw) as { e?: unknown };
    if (obj && obj.e === 1) return openFromMesh(obj as { h?: unknown; c?: unknown });
    const e = parse(obj);
    // Un message de salon en clair sur le Bluetooth n'est plus accepté.
    return e && e.kind !== CHAT_KIND ? e : null;
  } catch {
    return null;
  }
}

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
    void fromMesh(json).then((e) => {
      if (e) for (const l of listeners) l(e);
    });
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
          for (const raw of recent)
            void fromMesh(raw).then((e) => {
              if (e && matches(filter, e) && subs.has(sub))
                once(e, () => {
                  onEvent(e);
                  void pool.publish(e).catch(() => undefined);
                });
            });
      } catch {
        /* rien en mémoire */
      }
      return () => {
        subs.delete(sub);
        stop();
      };
    },
    async publish(e) {
      seen.add(e.id);
      const relays = pool.publish(e);
      // Échec des relais pris en charge tout de suite (le Bluetooth peut suffire).
      relays.catch(() => undefined);
      let viaMesh = false;
      try {
        // Salon : sous enveloppe, ou pas du tout. Autres messages : tels quels.
        const packet = e.kind === CHAT_KIND ? await sealForMesh(e) : JSON.stringify(e);
        viaMesh = packet !== null && a.meshSend?.(packet) === true;
      } catch {
        viaMesh = false;
      }
      if (!viaMesh) return relays;
      // Parti par Bluetooth : envoyé, même si les relais attendent internet.
    },
    close() {
      stopMesh();
      subs.clear();
      pool.close();
    },
  };
}
