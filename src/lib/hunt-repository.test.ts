// hunt-repository en mode « api » (registre partagé), avec un faux backend.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearSession } from "./api-client";
import {
  commit,
  createHunt,
  getDataMode,
  getHuntView,
  HuntActionError,
  isCommitted,
  listHuntViews,
  syncMyActivity,
} from "./hunt-repository";
import { getMyCommitment } from "./my-commitments";
import { getUserHunts } from "./user-hunts";

const ADDRESS = "kaspatest:qq_repo_wallet_aaaa";
const PUBLIC = {
  id: "h1",
  title: "Chasse",
  description: "D",
  location: "L",
  deadline: "2026-12-01T00:00:00.000Z",
  threshold: 3,
  progressVisibility: "hidden",
  status: "active",
  commitCount: null,
  createdAt: "2026-10-01T00:00:00.000Z",
};

function backend(routes: Record<string, { status: number; body: unknown }>) {
  const calls: { method: string; path: string; auth?: string; body?: unknown }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      const path = url.slice(url.indexOf("/api/"));
      const method = init.method ?? "GET";
      const headers = init.headers as Record<string, string>;
      calls.push({
        method,
        path,
        ...(headers["Authorization"] ? { auth: headers["Authorization"] } : {}),
        ...(init.body ? { body: JSON.parse(String(init.body)) } : {}),
      });
      const r = routes[`${method} ${path}`];
      if (!r) return new Response("{}", { status: 404 });
      return new Response(JSON.stringify(r.body), { status: r.status });
    }),
  );
  return calls;
}

const AUTH_ROUTES = {
  "POST /api/auth/challenge": { status: 200, body: { challengeId: "c".repeat(32), message: "m" } },
  "POST /api/auth/session": {
    status: 200,
    body: { accessToken: "session", expiresAt: Date.now() + 3_600_000 },
  },
};

beforeEach(() => {
  window.localStorage.clear();
  clearSession();
  vi.stubEnv("VITE_DATA_MODE", "api");
  vi.stubEnv("VITE_WALLET_MODE", "mock");
  window.localStorage.setItem(
    "huntited:wallet",
    JSON.stringify({ isConnected: true, address: ADDRESS }),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("hunt-repository (mode registre partagé)", () => {
  it("lit le mode depuis VITE_DATA_MODE", () => {
    expect(getDataMode()).toBe("api");
  });

  it("liste et lit les chasses du serveur ; compteur masqué conservé à null", async () => {
    backend({
      "GET /api/hunts": { status: 200, body: [PUBLIC] },
      "GET /api/hunts/h1": { status: 200, body: PUBLIC },
    });
    const [v] = await listHuntViews();
    expect(v!.hunt).toMatchObject({ id: "h1", deposit: 30, commitDeposit: 5, threshold: 3 });
    expect(v!.commitCount).toBeNull();
    expect(v!.status).toBe("active");
    expect((await getHuntView("h1"))?.hunt.title).toBe("Chasse");
    expect(await getHuntView("absente")).toBeUndefined();
  });

  it("créer : session signée puis POST /api/hunts avec le jeton", async () => {
    const calls = backend({
      ...AUTH_ROUTES,
      "POST /api/hunts": { status: 201, body: { ...PUBLIC, id: "nouvelle" } },
    });
    const id = await createHunt(
      {
        title: " Titre ",
        description: "D",
        location: "L",
        deadline: "2026-12-01T10:00",
        threshold: 3,
        deposit: 30,
        commitDeposit: 5,
        progressVisibility: "hidden",
      },
      ADDRESS,
    );
    expect(id).toBe("nouvelle");
    const post = calls.find((c) => c.path === "/api/hunts" && c.method === "POST")!;
    expect(post.auth).toBe("Bearer session");
    expect(post.body).toMatchObject({ title: "Titre", threshold: 3, progressVisibility: "hidden" });
  });

  it("s'engager : mémorise le rang localement (sans adresse brute)", async () => {
    backend({
      ...AUTH_ROUTES,
      "POST /api/hunts/h1/commit": { status: 201, body: { rank: 2, hunt: PUBLIC } },
    });
    expect(isCommitted("h1", ADDRESS)).toBe(false);
    await commit("h1", ADDRESS);
    expect(isCommitted("h1", ADDRESS)).toBe(true);
    expect(getMyCommitment(ADDRESS, "h1")?.rank).toBe(2);
    expect(window.localStorage.getItem("huntited:my-commitments")).not.toContain(ADDRESS);
  });

  it("déjà engagé·e côté serveur : on s'en souvient et on l'explique", async () => {
    backend({
      ...AUTH_ROUTES,
      "POST /api/hunts/h1/commit": {
        status: 409,
        body: { error: "Tu es déjà engagé·e dans cette chasse.", code: "already_committed" },
      },
    });
    const err = await commit("h1", ADDRESS).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HuntActionError);
    expect((err as Error).message).toBe("Tu es déjà engagé·e dans cette chasse.");
    expect(isCommitted("h1", ADDRESS)).toBe(true);
  });

  it("rang masqué (null) : engagement mémorisé sans rang, complété plus tard", async () => {
    backend({
      ...AUTH_ROUTES,
      "POST /api/hunts/h1/commit": { status: 201, body: { rank: null, hunt: PUBLIC } },
      "GET /api/me": {
        status: 200,
        body: {
          created: [{ ...PUBLIC, id: "mine" }],
          commitments: [
            { hunt: { ...PUBLIC, status: "activated" }, rank: 3, committedAt: PUBLIC.createdAt },
          ],
        },
      },
    });
    await commit("h1", ADDRESS);
    expect(isCommitted("h1", ADDRESS)).toBe(true);
    expect(getMyCommitment(ADDRESS, "h1")?.rank).toBeUndefined();

    // Autre appareil / plus tard : la synchronisation complète le rang et « Mes chasses ».
    expect(await syncMyActivity(ADDRESS)).toEqual({ created: 1, commitments: 1 });
    expect(getMyCommitment(ADDRESS, "h1")?.rank).toBe(3);
    expect(getUserHunts(ADDRESS).map((h) => h.huntId)).toEqual(["mine"]);
  });

  it("seuil personnel : envoyé au serveur et mémorisé (privé, sur cet appareil)", async () => {
    const calls = backend({
      ...AUTH_ROUTES,
      "POST /api/hunts/h1/commit": { status: 201, body: { rank: 1, hunt: PUBLIC } },
    });
    await commit("h1", ADDRESS, 7);
    const post = calls.find((c) => c.path === "/api/hunts/h1/commit")!;
    expect(post.body).toEqual({ personalThreshold: 7 });
    expect(getMyCommitment(ADDRESS, "h1")?.personalThreshold).toBe(7);
  });

  it("la synchronisation ne fait rien en mode local", async () => {
    vi.stubEnv("VITE_DATA_MODE", "local");
    const calls = backend({});
    expect(await syncMyActivity(ADDRESS)).toEqual({ created: 0, commitments: 0 });
    expect(calls).toEqual([]);
  });

  it("service indisponible : message neutre", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("network");
      }),
    );
    await expect(commit("h1", ADDRESS)).rejects.toThrow("temporairement indisponible");
  });
});
