import { schnorr } from "@noble/curves/secp256k1.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { REGISTRY_ADDRESS } from "../chain";
import { signArchive } from "./archive-signature";
import {
  getChainHunt,
  getChainMemberHunts,
  listChainHunts,
  resetBrowserIndex,
} from "./browser-index";
import { ARCHIVE_FORMAT } from "./indexer";
import { encodeMessage } from "./protocol";
import { memberPlaceKey } from "../org-pass";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  resetBrowserIndex();
});

const ARCHIVER = bytesToHex(schnorr.utils.randomSecretKey());

function archiveWithHunt(title: string) {
  const payload = bytesToHex(
    encodeMessage({
      t: "hunt",
      id: "ab".repeat(12),
      title,
      description: "Ensemble",
      location: "Mairie",
      deadline: Date.now() + 7 * 86_400_000,
      threshold: 7,
      deposit: 30,
      progressVisibility: "visible",
    }),
  );
  const entries = [
    { txId: "cd".repeat(32), score: 10, time: Date.now(), sender: "kaspatest:alice", payload },
  ];
  return { format: ARCHIVE_FORMAT, version: 1, registry: REGISTRY_ADDRESS, entries };
}

/** L'API ne connaît plus rien ; les archives répondent selon `files`. */
function serve(files: Record<string, unknown>) {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  vi.stubEnv("VITE_KASPA_API_URL", "https://api.test");
  vi.stubEnv("VITE_ARCHIVE_SIGNERS", bytesToHex(schnorr.getPublicKey(hexToBytes(ARCHIVER))));
  vi.stubEnv("VITE_CHAIN_ARCHIVES", Object.keys(files).join(","));
  vi.stubGlobal("fetch", async (url: string) => {
    if (url in files) return files[url] === null ? json({}, 404) : json(files[url]);
    if (url.includes("transactions-count")) return json({ total: 0 });
    if (url.includes("virtual-chain-blue-score")) return json({ blueScore: 100_000 });
    return json([]);
  });
}

describe("index du navigateur et archives", () => {
  it("retrouve une chasse que l'API a oubliée, grâce à l'archive en ligne signée", async () => {
    const a = archiveWithHunt("Conseil municipal");
    serve({
      "https://absente.test/a.json": null,
      "https://archive.test/a.json": { ...a, ...signArchive(a.entries, ARCHIVER) },
    });
    expect((await listChainHunts()).map((h) => h.title)).toEqual(["Conseil municipal"]);
  });

  it("refuse une archive en ligne non signée, ou modifiée après signature", async () => {
    const a = archiveWithHunt("Fausse chasse");
    const signed = { ...a, ...signArchive(a.entries, ARCHIVER) };
    const tampered = { ...signed, entries: archiveWithHunt("Autre").entries };
    serve({ "https://pirate.test/a.json": a, "https://pirate.test/b.json": tampered });
    expect(await listChainHunts()).toEqual([]);
  });

  it("accepte sans signature l'archive livrée avec le site (couverte par l'ancrage)", async () => {
    serve({ "./registry-snapshot.json": archiveWithHunt("Livrée avec le site") });
    expect((await listChainHunts()).map((h) => h.title)).toEqual(["Livrée avec le site"]);
  });
});

describe("modération", () => {
  it("une chasse masquée par la clé de publication disparaît de la liste ; sa page dit pourquoi", async () => {
    vi.stubEnv("VITE_RELEASE_PUBLISHERS", "kaspatest:publication");
    const a = archiveWithHunt("Chasse illégale");
    const hide = (sender: string, txId: string) => ({
      txId,
      score: 20,
      time: Date.now(),
      sender,
      payload: bytesToHex(encodeMessage({ t: "hide", hunt: "ab".repeat(12), reason: "illegal" })),
    });
    // Un masquage par une autre adresse ne compte pas.
    serve({
      "./registry-snapshot.json": {
        ...a,
        entries: [...a.entries, hide("kaspatest:alice", "ee".repeat(32))],
      },
    });
    expect((await listChainHunts()).map((h) => h.title)).toEqual(["Chasse illégale"]);
    resetBrowserIndex();
    serve({
      "./registry-snapshot.json": {
        ...a,
        entries: [...a.entries, hide("kaspatest:publication", "ff".repeat(32))],
      },
    });
    expect(await listChainHunts()).toEqual([]);
    expect((await getChainHunt("ab".repeat(12)))?.hidden).toBe("illegal");
  });
});

describe("pass d'organisation", () => {
  it("l'adhérent retrouve les chasses où son organisation lui a ouvert une place", async () => {
    const secret = bytesToHex(schnorr.utils.randomSecretKey());
    const hunt = "ab".repeat(12);
    const place = bytesToHex(schnorr.getPublicKey(hexToBytes(memberPlaceKey(secret, hunt))));
    const a = archiveWithHunt("Grève du 12");
    const places = {
      txId: "ee".repeat(32),
      score: 20,
      time: Date.now(),
      sender: "kaspatest:syndicat",
      payload: bytesToHex(encodeMessage({ t: "places", hunt, keys: [place] })),
    };
    serve({ "./registry-snapshot.json": { ...a, entries: [...a.entries, places] } });
    const mine = await getChainMemberHunts((h) =>
      bytesToHex(schnorr.getPublicKey(hexToBytes(memberPlaceKey(secret, h)))),
    );
    expect(mine.map((m) => [m.view.title, m.used])).toEqual([["Grève du 12", false]]);
    // Un autre adhérent (autre secret) n'y a pas de place.
    const other = bytesToHex(schnorr.utils.randomSecretKey());
    expect(
      await getChainMemberHunts((h) =>
        bytesToHex(schnorr.getPublicKey(hexToBytes(memberPlaceKey(other, h)))),
      ),
    ).toEqual([]);
  });
});
