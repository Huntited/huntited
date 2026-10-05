// Seuil personnel (docs/seuil-personnel.md) : groupe retenu, activation,
// engagements ouverts jusqu'à la date limite, accès au chat, confidentialité.
import type { Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";

import { makeWallet, startApp } from "../test-helpers.js";

let server: Server | undefined;
afterEach(() => server?.close());

async function setup(now?: () => number) {
  const app = await startApp(now ? { now } : {});
  server = app.server;
  return app;
}

/** Engage un nouveau wallet avec un seuil personnel ; renvoie son jeton. */
async function join(app: Awaited<ReturnType<typeof setup>>, id: string, t?: number) {
  const token = await app.login(makeWallet());
  const r = await app.post(
    `/api/hunts/${id}/commit`,
    t === undefined ? {} : { personalThreshold: t },
    token,
  );
  return { token, r };
}

const hunt = async (app: Awaited<ReturnType<typeof setup>>, id: string) =>
  (await app.get(`/api/hunts/${id}`)).body;

describe("seuil personnel", () => {
  it("refuse un seuil personnel inférieur au seuil de la chasse ou non entier", async () => {
    const app = await setup();
    const id = (await app.createHunt(await app.login(makeWallet()), { threshold: 3 })).body[
      "id"
    ] as string;
    expect((await join(app, id, 2)).r.status).toBe(400);
    expect((await join(app, id, 3.5)).r.status).toBe(400);
    expect((await join(app, id, 3)).r.status).toBe(201);
  });

  it("exemple du document : 3,3,4,10 n'active pas ; un 5e à 3 active un groupe de 4", async () => {
    const app = await setup();
    const id = (await app.createHunt(await app.login(makeWallet()), { threshold: 3 })).body[
      "id"
    ] as string;
    await join(app, id, 3);
    await join(app, id, 3);
    await join(app, id, 4);
    const bruno = await join(app, id, 10);
    expect(await hunt(app, id)).toMatchObject({
      status: "active",
      commitCount: 4,
      retainedCount: 0,
      retainedThreshold: null,
      commitsOpen: true,
    });

    const fifth = await join(app, id, 3);
    expect(await hunt(app, id)).toMatchObject({
      status: "activated",
      commitCount: 5,
      retainedCount: 4,
      retainedThreshold: 4,
      activationRank: 5,
      commitsOpen: true,
    });

    // Bruno (10) n'est pas retenu : pas d'accès au chat ; le 5e, si.
    expect((await app.post("/api/auth/chat-access", { huntId: id }, bruno.token)).status).toBe(401);
    expect((await app.post("/api/auth/chat-access", { huntId: id }, fifth.token)).status).toBe(200);
  });

  it("le groupe grandit après l'activation et finit par inclure une exigence plus haute", async () => {
    const app = await setup();
    const id = (await app.createHunt(await app.login(makeWallet()), { threshold: 2 })).body[
      "id"
    ] as string;
    const exigeant = await join(app, id, 4);
    await join(app, id);
    await join(app, id);
    expect((await hunt(app, id))["retainedCount"]).toBe(2);
    expect((await app.get("/api/me", exigeant.token)).body["commitments"]).toEqual([
      expect.objectContaining({ personalThreshold: 4, retained: false }),
    ]);

    await join(app, id);
    expect((await hunt(app, id))["retainedCount"]).toBe(4);
    expect((await app.get("/api/me", exigeant.token)).body["commitments"]).toEqual([
      expect.objectContaining({ personalThreshold: 4, retained: true }),
    ]);
  });

  it("engagements fermés après la date limite et après la résolution", async () => {
    let now = Date.now();
    const app = await setup(() => now);
    const tc = await app.login(makeWallet());
    const a = (await app.createHunt(tc, { threshold: 1 })).body["id"] as string;
    const b = (await app.createHunt(tc, { threshold: 1 })).body["id"] as string;
    await join(app, a);
    await join(app, b);
    await app.post(`/api/hunts/${a}/settle`);
    expect((await join(app, a)).r.body["code"]).toBe("closed");
    now += 2 * 86_400_000;
    expect((await hunt(app, b))["commitsOpen"]).toBe(false);
    expect((await join(app, b)).r.body["code"]).toBe("closed");
  });

  it("les seuils personnels ne sont jamais publiés ; tout est masqué si demandé", async () => {
    const app = await setup();
    const id = (
      await app.createHunt(await app.login(makeWallet()), {
        threshold: 3,
        progressVisibility: "hidden",
      })
    ).body["id"] as string;
    await join(app, id, 42);
    const text = (await app.get(`/api/hunts/${id}`)).text;
    expect(text).not.toContain("42");
    expect(text).not.toContain("personalThreshold");
    expect(await hunt(app, id)).toMatchObject({
      commitCount: null,
      retainedCount: null,
      retainedThreshold: null,
    });
  });
});
