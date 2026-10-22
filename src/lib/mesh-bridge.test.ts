import { schnorr } from "@noble/curves/secp256k1.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { meshAvailable, withMesh } from "./mesh-bridge";
import type { NostrFilter, RelayPool } from "./nostr-relays";
import { CHAT_KIND, chatTopic, signEvent, type NostrEvent } from "./p2p-chat";

const HUNT = "a".repeat(24);
const filter: NostrFilter = { kinds: [CHAT_KIND], "#h": [chatTopic(HUNT)] };

function event(text: string, hunt = HUNT): NostrEvent {
  const priv = bytesToHex(schnorr.utils.randomSecretKey());
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

function installApp(recent: NostrEvent[] = [], sendOk = true) {
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

  it("envoie au mesh et aux relais ; sans internet, le Bluetooth suffit", async () => {
    const sent = installApp();
    const { pool, published } = fakePool(false);
    const e = event("salut");
    await expect(withMesh(pool).publish(e)).resolves.toBeUndefined();
    expect(JSON.parse(sent[0]!)).toEqual(e);
    expect(published).toEqual([e]);
    expect(meshAvailable()).toBe(true);
  });

  it("sans voisin Bluetooth ni internet, l'envoi échoue (le bouton réessayer reste)", async () => {
    installApp([], false);
    const { pool } = fakePool(false);
    await expect(withMesh(pool).publish(event("x"))).rejects.toThrow();
  });

  it("reçoit les messages du mesh, une seule fois, et les renvoie aux relais", () => {
    installApp();
    const { pool, published, push } = fakePool(true);
    const got: string[] = [];
    withMesh(pool).subscribe(filter, (e) => got.push(e.content));
    const e = event("par bluetooth");
    (window as unknown as W).__huntitedMesh!(JSON.stringify(e));
    (window as unknown as W).__huntitedMesh!(JSON.stringify(e));
    push(e); // le même arrive ensuite par un relais
    expect(got).toEqual(["par bluetooth"]);
    expect(published).toEqual([e]);
  });

  it("écarte les messages falsifiés ou d'une autre chasse", () => {
    installApp();
    const { pool } = fakePool(true);
    const got: string[] = [];
    withMesh(pool).subscribe(filter, (e) => got.push(e.content));
    const forged = { ...event("vrai"), content: "faux" };
    (window as unknown as W).__huntitedMesh!(JSON.stringify(forged));
    (window as unknown as W).__huntitedMesh!(JSON.stringify(event("ailleurs", "b".repeat(24))));
    (window as unknown as W).__huntitedMesh!("pas du json");
    expect(got).toEqual([]);
  });

  it("rattrape les messages reçus par le mesh pendant que la page était fermée", () => {
    const old = event("pendant l'absence");
    installApp([old]);
    const { pool, published } = fakePool(true);
    const got: string[] = [];
    withMesh(pool).subscribe(filter, (e) => got.push(e.content));
    expect(got).toEqual(["pendant l'absence"]);
    expect(published).toEqual([old]);
  });

  it("une page fermée ne reçoit plus rien", () => {
    installApp();
    const { pool } = fakePool(true);
    const got: string[] = [];
    const p = withMesh(pool);
    p.subscribe(filter, (e) => got.push(e.content));
    p.close();
    (window as unknown as W).__huntitedMesh!(JSON.stringify(event("après")));
    expect(got).toEqual([]);
    expect(pool.close).toHaveBeenCalled();
  });
});
