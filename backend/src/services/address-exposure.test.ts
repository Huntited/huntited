import type { Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";

import { startApp } from "../test-helpers.js";
import { analyzeExposure, type ApiTransaction } from "./address-exposure.js";

const ME = `kaspatest:${"q".repeat(61)}`;
const FAUCET = "kaspatest:faucet";
const SHOP = "kaspatest:shop";
const REGISTRY = "kaspatest:registry";

const tx = (from: string[], to: string[], accepted = true): ApiTransaction => ({
  is_accepted: accepted,
  inputs: from.map((a) => ({ previous_outpoint_address: a })),
  outputs: to.map((a) => ({ script_public_key_address: a })),
});

describe("compte dédié", () => {
  it("adresse neuve ou alimentée par une seule source : dédiée", () => {
    expect(analyzeExposure(ME, [])).toEqual({ usedElsewhere: false, reasons: [] });
    expect(
      analyzeExposure(
        ME,
        [tx([FAUCET], [ME, FAUCET]), tx([FAUCET], [ME]), tx([ME], [REGISTRY, ME])],
        [REGISTRY],
      ),
    ).toEqual({ usedElsewhere: false, reasons: [] });
  });

  it("envoi ailleurs, ou plusieurs sources : déjà utilisée", () => {
    expect(analyzeExposure(ME, [tx([ME], [SHOP, ME])])).toEqual({
      usedElsewhere: true,
      reasons: ["sent_elsewhere"],
    });
    expect(analyzeExposure(ME, [tx([FAUCET], [ME]), tx([SHOP], [ME])])).toEqual({
      usedElsewhere: true,
      reasons: ["many_sources"],
    });
    // Transactions non acceptées ignorées.
    expect(analyzeExposure(ME, [tx([ME], [SHOP], false)]).usedElsewhere).toBe(false);
  });
});

let server: Server | undefined;
afterEach(() => server?.close());

describe("POST /api/wallet/exposure", () => {
  it("réseau de test uniquement ; lit l'API publique ; 503 si elle ne répond pas", async () => {
    const asked: string[] = [];
    let up = true;
    const app = await startApp({
      walletCheck: {
        apiUrl: "https://api-tn10.test",
        fetch: (async (url: string) => {
          asked.push(url);
          return up
            ? new Response(JSON.stringify([tx([ME], [SHOP])]), { status: 200 })
            : new Response("", { status: 500 });
        }) as typeof fetch,
      },
    });
    server = app.server;
    expect((await app.post("/api/wallet/exposure", { address: "kaspa:qqmainnet" })).status).toBe(
      400,
    );
    const r = await app.post("/api/wallet/exposure", { address: ME });
    expect(r.body).toEqual({ usedElsewhere: true, reasons: ["sent_elsewhere"] });
    expect(asked[0]).toContain(`/addresses/${encodeURIComponent(ME)}/full-transactions`);
    up = false;
    expect((await app.post("/api/wallet/exposure", { address: ME })).status).toBe(503);
  });
});
