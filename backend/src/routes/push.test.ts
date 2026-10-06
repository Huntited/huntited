// Notifications « me prévenir » et effacement des chasses ratées.
import type { Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";

import { fingerprintWallet } from "../services/auth-service.js";
import { ChatService } from "../services/chat-service.js";
import { MemoryChatStore } from "../services/chat-store.js";
import { runMaintenance } from "../services/maintenance.js";
import { MockMatrixService } from "../services/matrix-service.js";
import { PushService, type PushSubscription } from "../services/push-service.js";
import { makeWallet, startApp } from "../test-helpers.js";
import { isPushEndpoint } from "./push.js";

let server: Server | undefined;
afterEach(() => server?.close());

const sub = (n: number): PushSubscription => ({
  endpoint: `https://fcm.googleapis.com/fcm/send/abc${n}`,
  keys: {
    p256dh:
      "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM",
    auth: "tBHItJI5svbpez7KI4CCXg",
  },
});

async function setup() {
  let now = Date.now();
  const sent: { endpoint: string; payload: Record<string, unknown> }[] = [];
  const push = new PushService(async (s, payload) => {
    sent.push({ endpoint: s.endpoint, payload: JSON.parse(payload) as Record<string, unknown> });
  });
  const app = await startApp({ now: () => now, push });
  server = app.server;
  const chat = new ChatService(new MemoryChatStore(), new MockMatrixService("https://m.test"));
  const tick = (ms: number) => {
    now += ms;
  };
  return { app, push, sent, chat, tick };
}

describe("me prévenir (Web Push)", () => {
  it("n'accepte que les services de push des navigateurs", () => {
    expect(isPushEndpoint("https://fcm.googleapis.com/fcm/send/x")).toBe(true);
    expect(isPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/x")).toBe(true);
    expect(isPushEndpoint("https://web.push.apple.com/x")).toBe(true);
    expect(isPushEndpoint("http://fcm.googleapis.com/x")).toBe(false);
    expect(isPushEndpoint("https://fcm.googleapis.com:8443/x")).toBe(false);
    expect(isPushEndpoint("https://evil-fcm.googleapis.com.attacker.net/x")).toBe(false);
    expect(isPushEndpoint("https://127.0.0.1/x")).toBe(false);
    expect(isPushEndpoint("https://localhost/x")).toBe(false);
  });

  it("prévient au déclenchement, sans wallet, puis oublie l'abonnement", async () => {
    const { app, push, sent } = await setup();
    const tc = await app.login(makeWallet());
    const id = (await app.createHunt(tc, { threshold: 2, title: "Nettoyage" })).body[
      "id"
    ] as string;
    // S'abonner ne demande aucune session.
    const r = await app.post("/api/push/subscribe", {
      huntId: id,
      subscription: sub(1),
      locale: "en",
    });
    expect(r.status).toBe(201);
    expect(
      (
        await app.post("/api/push/subscribe", {
          huntId: id,
          subscription: { ...sub(2), endpoint: "https://10.0.0.1/x" },
        })
      ).status,
    ).toBe(400);

    await app.post(`/api/hunts/${id}/commit`, {}, await app.login(makeWallet()));
    expect(sent).toHaveLength(0);
    await app.post(`/api/hunts/${id}/commit`, {}, await app.login(makeWallet()));
    await new Promise((r) => setTimeout(r, 10));
    expect(sent).toEqual([
      {
        endpoint: sub(1).endpoint,
        payload: { huntId: id, kind: "activated", title: "Nettoyage", locale: "en" },
      },
    ]);
    expect(push.count(id)).toBe(0);
    // Chasse déclenchée : plus d'abonnement possible.
    expect(
      (await app.post("/api/push/subscribe", { huntId: id, subscription: sub(3) })).status,
    ).toBe(409);
  });

  it("se désabonner fonctionne", async () => {
    const { app, push } = await setup();
    const id = (await app.createHunt(await app.login(makeWallet()))).body["id"] as string;
    await app.post("/api/push/subscribe", { huntId: id, subscription: sub(1) });
    expect(push.count(id)).toBe(1);
    expect(
      (await app.post("/api/push/unsubscribe", { huntId: id, endpoint: sub(1).endpoint })).status,
    ).toBe(204);
    expect(push.count(id)).toBe(0);
  });

  it("à la date limite ratée : notification, puis effacement des engagements 24 h après", async () => {
    const { app, push, sent, chat, tick } = await setup();
    const id = (await app.createHunt(await app.login(makeWallet()), { threshold: 3 })).body[
      "id"
    ] as string;
    await app.post("/api/push/subscribe", { huntId: id, subscription: sub(1) });
    const committer = makeWallet();
    await app.post(`/api/hunts/${id}/commit`, {}, await app.login(committer));
    const activity = () => app.registry.activityFor(fingerprintWallet(committer.address));
    expect(activity().commitments).toHaveLength(1);
    const deps = { registry: app.registry, chat, push };

    await runMaintenance(deps);
    expect(sent).toHaveLength(0); // encore en cours

    tick(86_400_000 + 1); // date limite passée
    await runMaintenance(deps);
    expect(sent.map((s) => s.payload["kind"])).toEqual(["failed"]);
    expect(app.registry.commitCount(id)).toBe(1); // pas encore effacé

    tick(86_400_000); // 24 h plus tard
    await runMaintenance(deps);
    const hunt = (await app.get(`/api/hunts/${id}`)).body;
    expect(hunt["commitCount"]).toBe(1); // seul le nombre reste
    expect(hunt["status"]).toBe("expired");
    expect(JSON.stringify(app.registry.list())).toContain('"purgedCommitCount":1');
    // Plus aucune empreinte d'engagement : l'activité du wallet ne la montre plus.
    expect(activity().commitments).toEqual([]);
    expect(sent).toHaveLength(1);
  });
});
