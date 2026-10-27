import { schnorr } from "@noble/curves/secp256k1.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { meshAvailable, openFromMesh, sealForMesh, setMeshRoomKey, withMesh } from "./mesh-bridge";
import type { NostrFilter, RelayPool } from "./nostr-relays";
import { CHAT_KIND, chatTopic, signEvent, type NostrEvent } from "./p2p-chat";
import { newPresenceKey } from "./presence";

const HUNT = "a".repeat(24);
const OTHER = "b".repeat(24);
const filter: NostrFilter = { kinds: [CHAT_KIND], "#h": [chatTopic(HUNT)] };
const KEY = newPresenceKey();
setMeshRoomKey(chatTopic(HUNT), KEY);

const priv = bytesToHex(schnorr.utils.randomSecretKey());
function event(text: string, hunt = HUNT): NostrEvent {
  return signEvent(
    { kind: CHAT_KIND, created_at: 1_800_000_000, tags: [["h", chatTopic(hunt)]], content: text },
    priv,
  );
}

/** Faux relais : on choisit s'ils acceptent, on pousse des événements à la main. */
function fakePool(online: boolean) {
  const published: NostrEvent[] = [];
  let push: (e: NostrEvent) => void = () => undefined;
  const pool: RelayPool = {
    subscribe(_f, onEvent) {
      push = onEvent;
      return () => undefined;
    },
    publish(e) {
      published.push(e);
      return online ? Promise.resolve() : Promise.reject(new Error("relays_timeout"));
    },
    close: vi.fn(),
  };
  return { pool, published, push: (e: NostrEvent) => push(e) };
}

type W = { HuntitedApp?: unknown; __huntitedMesh?: (json: string) => void };

function installApp(recent: unknown[] = [], sendOk = true) {
  const sent: string[] = [];
  (window as unknown as W).HuntitedApp = {
    meshAvailable: () => true,
    meshSend: (json: string) => {
      sent.push(json);
      return sendOk;
    },
    meshRecent: () => JSON.stringify(recent),
  };
  return sent;
}

const flush = () => new Promise((r) => setTimeout(r, 20));
const fromApp = (json: string) => (window as unknown as W).__huntitedMesh!(json);

afterEach(() => {
  delete (window as unknown as W).HuntitedApp;
  delete (window as unknown as W).__huntitedMesh;
});

describe("mesh Bluetooth (app Huntited Chat)", () => {
  it("ne change rien hors de l'app", () => {
    const { pool } = fakePool(true);
    expect(withMesh(pool)).toBe(pool);
    expect(meshAvailable()).toBe(false);
  });

  it("sur le Bluetooth, ni auteur ni salon visibles : une enveloppe illisible", async () => {
    const sent = installApp();
    const { pool } = fakePool(true);
    const e = event("rendez-vous 18 h");
    await withMesh(pool).publish(e);
    expect(sent).toHaveLength(1);
    const packet = sent[0]!;
    expect(packet).not.toContain(e.pubkey);
    expect(packet).not.toContain(chatTopic(HUNT));
    expect(packet).not.toContain("rendez-vous");
    expect(Object.keys(JSON.parse(packet))).toEqual(["e", "h", "c"]);
  });

  it("sans internet, le Bluetooth suffit", async () => {
    installApp();
    const { pool, published } = fakePool(false);
    const e = event("salut");
    await expect(withMesh(pool).publish(e)).resolves.toBeUndefined();
    expect(published).toEqual([e]);
    expect(meshAvailable()).toBe(true);
  });

  it("salon sans clé commune : rien sur le Bluetooth, internet seulement", async () => {
    const sent = installApp();
    const { pool } = fakePool(false);
    await expect(withMesh(pool).publish(event("x", OTHER))).rejects.toThrow();
    expect(sent).toHaveLength(0);
  });

  it("les membres ouvrent l'enveloppe ; une autre clé, non", async () => {
    const e = event("bonjour");
    const env = JSON.parse((await sealForMesh(e))!) as { h: string; c: string };
    expect(await openFromMesh(env)).toEqual(e);
    // Un téléphone qui n'a pas la clé de ce salon (seulement une autre) ne lit rien.
    expect(await openFromMesh({ ...env, h: "0".repeat(64) })).toBeNull();
    // L'étiquette change avec l'heure (pas de suivi d'un salon dans la durée).
    const later = JSON.parse((await sealForMesh(e, Date.now() + 2 * 3_600_000))!) as { h: string };
    expect(later.h).not.toBe(env.h);
  });

  it("reçoit les messages du mesh, une seule fois, et les renvoie aux relais", async () => {
    installApp();
    const { pool, published, push } = fakePool(true);
    const got: string[] = [];
    withMesh(pool).subscribe(filter, (e) => got.push(e.content));
    const e = event("par bluetooth");
    const packet = (await sealForMesh(e))!;
    fromApp(packet);
    fromApp(packet);
    await flush();
    push(e); // le même arrive ensuite par un relais
    expect(got).toEqual(["par bluetooth"]);
    expect(published).toEqual([e]);
  });

  it("refuse un message de salon en clair, falsifié ou illisible", async () => {
    installApp();
    const { pool } = fakePool(true);
    const got: string[] = [];
    withMesh(pool).subscribe(filter, (e) => got.push(e.content));
    fromApp(JSON.stringify(event("en clair"))); // ancien format : refusé
    fromApp(JSON.stringify({ e: 1, h: "0".repeat(64), c: "AAAA" }));
    fromApp("pas du json");
    await flush();
    expect(got).toEqual([]);
  });

  it("rattrape les messages reçus par le mesh pendant que la page était fermée", async () => {
    const old = event("pendant l'absence");
    installApp([JSON.parse((await sealForMesh(old))!)]);
    const { pool, published } = fakePool(true);
    const got: string[] = [];
    withMesh(pool).subscribe(filter, (e) => got.push(e.content));
    await flush();
    expect(got).toEqual(["pendant l'absence"]);
    expect(published).toEqual([old]);
  });

  it("une page fermée ne reçoit plus rien", async () => {
    installApp();
    const { pool } = fakePool(true);
    const got: string[] = [];
    const p = withMesh(pool);
    p.subscribe(filter, (e) => got.push(e.content));
    p.close();
    fromApp((await sealForMesh(event("après")))!);
    await flush();
    expect(got).toEqual([]);
    expect(pool.close).toHaveBeenCalled();
  });
});
