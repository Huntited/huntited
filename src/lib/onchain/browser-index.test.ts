import { bytesToHex } from "@noble/hashes/utils.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { REGISTRY_ADDRESS } from "../chain";
import { listChainHunts, resetBrowserIndex } from "./browser-index";
import { ARCHIVE_FORMAT } from "./indexer";
import { encodeMessage } from "./protocol";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  resetBrowserIndex();
});

describe("index du navigateur et archives", () => {
  it("retrouve une chasse que l'API publique a oubliée, grâce à l'archive", async () => {
    vi.stubEnv("VITE_KASPA_API_URL", "https://api.test");
    vi.stubEnv("VITE_CHAIN_ARCHIVES", "https://absente.test/a.json,https://archive.test/a.json");
    const deadline = Date.now() + 7 * 86_400_000;
    const payload = bytesToHex(
      encodeMessage({
        t: "hunt",
        id: "ab".repeat(12),
        title: "Conseil municipal",
        description: "Ensemble",
        location: "Mairie",
        deadline,
        threshold: 7,
        deposit: 30,
        progressVisibility: "visible",
      }),
    );
    const archive = {
      format: ARCHIVE_FORMAT,
      version: 1,
      registry: REGISTRY_ADDRESS,
      entries: [
        { txId: "cd".repeat(32), score: 10, time: Date.now(), sender: "kaspatest:alice", payload },
      ],
    };
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
    vi.stubGlobal("fetch", async (url: string) => {
      if (url.startsWith("https://archive.test")) return json(archive);
      if (url.startsWith("https://absente.test")) return json({}, 404);
      // L'API ne connaît plus rien.
      if (url.includes("transactions-count")) return json({ total: 0 });
      if (url.includes("virtual-chain-blue-score")) return json({ blueScore: 100_000 });
      return json([]);
    });
    const hunts = await listChainHunts();
    expect(hunts.map((h) => h.title)).toEqual(["Conseil municipal"]);
  });
});
