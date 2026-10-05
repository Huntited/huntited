// Registre partagé : création, engagements, statuts, masquage, persistance.
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { fingerprintWallet } from "../services/auth-service.js";
import { HuntRegistry } from "../services/hunt-registry.js";
import { makeWallet, startApp } from "../test-helpers.js";

const CREATOR = makeWallet();
const A = makeWallet();
const B = makeWallet();

let server: Server | undefined;
afterEach(() => server?.close());

async function setup(opts: Parameters<typeof startApp>[0] = {}) {
  const app = await startApp(opts);
  server = app.server;
  return app;
}

describe("création", () => {
  it("exige une session et des champs valides", async () => {
    const app = await setup();
    expect((await app.createHunt("pas-un-jeton")).status).toBe(401);
    const t = await app.login(CREATOR);
    expect((await app.createHunt(t, { threshold: 0 })).status).toBe(400);
    expect((await app.createHunt(t, { deadline: new Date(0).toISOString() })).status).toBe(400);
    expect((await app.createHunt(t, { title: "" })).status).toBe(400);

    const ok = await app.createHunt(t, { progressVisibility: "hidden" });
    expect(ok.status).toBe(201);
    expect(ok.body).toMatchObject({ status: "active", threshold: 2, progressVisibility: "hidden" });
  });

  it("une chasse créée est visible par tout le monde, sans session", async () => {
    const app = await setup();
    const t = await app.login(CREATOR);
    const id = (await app.createHunt(t)).body["id"] as string;
    expect((await app.get(`/api/hunts/${id}`)).body["title"]).toBe("Chasse");
    expect(((await app.get("/api/hunts")).body as unknown as unknown[]).length).toBe(1);
    expect((await app.get("/api/hunts/inconnue")).status).toBe(404);
  });
});

describe("engagements", () => {
  it("une fois par wallet, rang croissant, activation au seuil", async () => {
    const app = await setup();
    const id = (await app.createHunt(await app.login(CREATOR))).body["id"] as string;
    const ta = await app.login(A);
    const tb = await app.login(B);

    const first = await app.post(`/api/hunts/${id}/commit`, {}, ta);
    expect(first.status).toBe(201);
    expect(first.body["rank"]).toBe(1);
    expect((await app.post(`/api/hunts/${id}/commit`, {}, ta)).body["code"]).toBe(
      "already_committed",
    );

    const second = await app.post(`/api/hunts/${id}/commit`, {}, tb);
    expect(second.body["rank"]).toBe(2);
    expect((second.body["hunt"] as Record<string, unknown>)["status"]).toBe("activated");

    // Option B : les engagements restent ouverts après l'activation.
    const late = await app.post(`/api/hunts/${id}/commit`, {}, await app.login(makeWallet()));
    expect(late.status).toBe(201);
    expect(late.body["rank"]).toBe(3);
    expect((late.body["hunt"] as Record<string, unknown>)["status"]).toBe("activated");
  });

  it("refusé sans session", async () => {
    const app = await setup();
    const id = (await app.createHunt(await app.login(CREATOR))).body["id"] as string;
    expect((await app.post(`/api/hunts/${id}/commit`, {})).status).toBe(401);
  });

  it("l'activation prime sur l'expiration ; l'expiration ferme les engagements", async () => {
    let now = Date.now();
    const app = await setup({ now: () => now });
    const tc = await app.login(CREATOR);
    const won = (await app.createHunt(tc, { threshold: 1 })).body["id"] as string;
    const lost = (await app.createHunt(tc, { threshold: 5 })).body["id"] as string;
    const ta = await app.login(A);
    await app.post(`/api/hunts/${won}/commit`, {}, ta);
    await app.post(`/api/hunts/${lost}/commit`, {}, ta);

    now += 2 * 86_400_000; // après la deadline
    expect((await app.get(`/api/hunts/${won}`)).body["status"]).toBe("activated");
    expect((await app.get(`/api/hunts/${lost}`)).body["status"]).toBe("expired");
    const tb = await app.login(B);
    expect((await app.post(`/api/hunts/${lost}/commit`, {}, tb)).body["code"]).toBe("closed");
  });
});

describe("progression masquée (côté serveur)", () => {
  it("le compteur n'est jamais renvoyé pendant la phase d'engagement", async () => {
    const app = await setup();
    const tc = await app.login(CREATOR);
    const id = (await app.createHunt(tc, { threshold: 2, progressVisibility: "hidden" })).body[
      "id"
    ] as string;
    const r1 = await app.post(`/api/hunts/${id}/commit`, {}, await app.login(A));
    expect((r1.body["hunt"] as Record<string, unknown>)["commitCount"]).toBeNull();
    expect((await app.get(`/api/hunts/${id}`)).body["commitCount"]).toBeNull();
    expect((await app.get("/api/hunts")).text).not.toContain('"commitCount":1');

    await app.post(`/api/hunts/${id}/commit`, {}, await app.login(B));
    expect((await app.get(`/api/hunts/${id}`)).body["commitCount"]).toBe(2);
  });
});

describe("résolution simulée", () => {
  it("succès si activée, échec si expirée ; impossible si active", async () => {
    let now = Date.now();
    const app = await setup({ now: () => now });
    const tc = await app.login(CREATOR);
    const won = (await app.createHunt(tc, { threshold: 1 })).body["id"] as string;
    const lost = (await app.createHunt(tc, { threshold: 5 })).body["id"] as string;
    expect((await app.post(`/api/hunts/${lost}/settle`)).status).toBe(409);
    await app.post(`/api/hunts/${won}/commit`, {}, await app.login(A));
    expect((await app.post(`/api/hunts/${won}/settle`)).body["outcome"]).toBe("success");
    now += 2 * 86_400_000;
    expect((await app.post(`/api/hunts/${lost}/settle`)).body["outcome"]).toBe("failure");
  });
});

describe("persistance", () => {
  it("survit à un redémarrage et ne stocke aucune adresse", async () => {
    const dir = mkdtempSync(join(tmpdir(), "huntited-"));
    const file = join(dir, "registry.json");
    try {
      const app = await setup({ registry: new HuntRegistry({ file }) });
      const id = (await app.createHunt(await app.login(CREATOR), { threshold: 1 })).body[
        "id"
      ] as string;
      await app.post(`/api/hunts/${id}/commit`, {}, await app.login(A));

      const reloaded = new HuntRegistry({ file });
      expect(reloaded.commitCount(id)).toBe(1);
      expect(reloaded.getWalletRole(id, fingerprintWallet(CREATOR.address))).toBe("creator");
      expect(reloaded.getWalletRole(id, fingerprintWallet(A.address))).toBe("participant");
      expect(reloaded.getWalletRole(id, fingerprintWallet(B.address))).toBeUndefined();

      const raw = readFileSync(file, "utf8");
      for (const w of [CREATOR, A]) expect(raw).not.toContain(w.address);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
