// Activité du wallet (GET /api/me) et rang masqué pour les chasses masquées.
import type { Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";

import { makeWallet, startApp } from "../test-helpers.js";

const CREATOR = makeWallet();
const A = makeWallet();
const B = makeWallet();

let server: Server | undefined;
afterEach(() => server?.close());

async function setup() {
  const app = await startApp();
  server = app.server;
  return app;
}

type Me = {
  created: { id: string }[];
  commitments: { hunt: { id: string; status: string }; rank: number | null; committedAt: string }[];
};

describe("GET /api/me", () => {
  it("exige une session", async () => {
    const app = await setup();
    expect((await app.get("/api/me")).status).toBe(401);
  });

  it("renvoie les chasses créées et les engagements de ce wallet seulement", async () => {
    const app = await setup();
    const tc = await app.login(CREATOR);
    const ta = await app.login(A);
    const h1 = (await app.createHunt(tc, { threshold: 3 })).body["id"] as string;
    const h2 = (await app.createHunt(ta, { threshold: 3 })).body["id"] as string;
    await app.post(`/api/hunts/${h1}/commit`, {}, ta);
    await app.post(`/api/hunts/${h1}/commit`, {}, await app.login(B));

    const meC = (await app.get("/api/me", tc)).body as unknown as Me;
    expect(meC.created.map((h) => h.id)).toEqual([h1]);
    expect(meC.commitments).toEqual([]);

    const meA = (await app.get("/api/me", ta)).body as unknown as Me;
    expect(meA.created.map((h) => h.id)).toEqual([h2]);
    expect(meA.commitments).toEqual([
      expect.objectContaining({ hunt: expect.objectContaining({ id: h1 }), rank: 1 }),
    ]);
  });

  it("ne contient ni empreinte ni adresse", async () => {
    const app = await setup();
    const tc = await app.login(CREATOR);
    await app.createHunt(tc);
    const text = (await app.get("/api/me", tc)).text;
    expect(text).not.toContain(CREATOR.address);
    expect(text).not.toContain("creatorKey");
    expect(text).not.toContain("commitKey");
  });
});

describe("rang et progression masquée", () => {
  it("rang masqué tant que la chasse masquée est active, révélé à l'activation", async () => {
    const app = await setup();
    const tc = await app.login(CREATOR);
    const id = (await app.createHunt(tc, { threshold: 2, progressVisibility: "hidden" })).body[
      "id"
    ] as string;
    const ta = await app.login(A);

    const first = await app.post(`/api/hunts/${id}/commit`, {}, ta);
    expect(first.body["rank"]).toBeNull();
    expect(((await app.get("/api/me", ta)).body as unknown as Me).commitments[0]!.rank).toBeNull();

    const second = await app.post(`/api/hunts/${id}/commit`, {}, await app.login(B));
    expect(second.body["rank"]).toBe(2); // chasse activée : plus rien à cacher
    expect(((await app.get("/api/me", ta)).body as unknown as Me).commitments[0]!.rank).toBe(1);
  });

  it("rang visible immédiatement pour une chasse à progression visible", async () => {
    const app = await setup();
    const id = (await app.createHunt(await app.login(CREATOR), { threshold: 5 })).body[
      "id"
    ] as string;
    expect((await app.post(`/api/hunts/${id}/commit`, {}, await app.login(A))).body["rank"]).toBe(
      1,
    );
  });
});
