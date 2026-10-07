// Index du registre : ordre, finalité, pagination, et routes publiques
// (aucune adresse renvoyée). Réseau simulé.
import { randomBytes } from "node:crypto";
import type { Server } from "node:http";

import { bytesToHex } from "@noble/hashes/utils.js";
import { afterEach, describe, expect, it } from "vitest";

import { decodeKaspaAddress } from "../services/kaspa-signature.js";
import { startApp } from "../test-helpers.js";
import { ChainIndexer, type ChainSource, type RestTransaction } from "./indexer.js";
import { Ledger } from "./ledger.js";
import { encodeMessage, type Message } from "./protocol.js";
import { REGISTRY_LABEL, registryAddress } from "./registry-address.js";

const REGISTRY = registryAddress();
const T0 = Date.UTC(2026, 9, 7, 12);
const DAY = 86_400_000;

function fakeChain() {
  const txs: RestTransaction[] = [];
  let tip = 1_000;
  let n = 0;
  const source: ChainSource = {
    virtualBlueScore: async () => tip,
    // Plus récentes d'abord, comme l'API publique.
    addressTransactions: async (_a, offset, limit) =>
      [...txs]
        .sort((a, b) => (b.accepting_block_blue_score ?? 0) - (a.accepting_block_blue_score ?? 0))
        .slice(offset, offset + limit),
  };
  const send = (m: Message, sender: string, score: number, accepted = true) => {
    txs.push({
      transaction_id: `tx${String(++n).padStart(4, "0")}`,
      is_accepted: accepted,
      accepting_block_blue_score: score,
      accepting_block_time: T0 + score,
      payload: bytesToHex(encodeMessage(m)),
      inputs: [{ previous_outpoint_address: sender }],
    });
  };
  const ledger = new Ledger({
    invitationKeys: [],
    minThreshold: 2,
    minCautionKas: 30,
    invitesPerMonth: 3,
    passRequired: false,
  });
  const indexer = new ChainIndexer(source, REGISTRY, ledger, 100);
  return { send, indexer, ledger, setTip: (s: number) => (tip = s), txs };
}

const hunt = (id: string): Message => ({
  t: "hunt",
  id,
  title: "Conseil municipal",
  description: "Ensemble",
  location: "Mairie",
  deadline: T0 + 7 * DAY,
  threshold: 2,
  deposit: 30,
  progressVisibility: "visible",
});

describe("adresse du registre", () => {
  it("est stable, du réseau de test, et dérivée d'une phrase publique", () => {
    expect(registryAddress()).toBe(REGISTRY);
    expect(REGISTRY.startsWith("kaspatest:")).toBe(true);
    expect(decodeKaspaAddress(REGISTRY).prefix).toBe("kaspatest");
    expect(registryAddress("kaspatest", `${REGISTRY_LABEL}-autre`)).not.toBe(REGISTRY);
  });
});

describe("index", () => {
  it("rejoue dans l'ordre de la chaîne, seulement les transactions finales", async () => {
    const { send, indexer, ledger, setTip } = fakeChain();
    const id = randomBytes(12).toString("hex");
    // Arrivées dans le désordre : l'engagement d'Alice avant la chasse (score plus bas)
    // doit être refusé ; celui de Bob, après, accepté.
    send({ t: "commit", hunt: id }, "kaspatest:bob", 300);
    send(hunt(id), "kaspatest:alice", 200);
    send({ t: "commit", hunt: id }, "kaspatest:alice", 150);
    send({ t: "commit", hunt: id }, "kaspatest:carol", 250, false); // non acceptée
    send({ t: "commit", hunt: id }, "kaspatest:dave", 950); // pas encore finale

    expect(await indexer.sync()).toBe(3);
    const h = ledger.hunt(id)!;
    expect(h.commits.map((c) => c.who)).toEqual(["a:kaspatest:bob"]);
    expect(indexer.appliedScore()).toBe(900);

    // Plus tard : l'engagement de Dave devient final.
    setTip(1_100);
    expect(await indexer.sync()).toBe(1);
    expect(h.commits).toHaveLength(2);
    expect(h.activatedAt).toBe(T0 + 950);
    expect(await indexer.sync()).toBe(0);
  });

  it("parcourt plusieurs pages", async () => {
    const { send, indexer, ledger } = fakeChain();
    const id = randomBytes(12).toString("hex");
    send(hunt(id), "kaspatest:alice", 1);
    for (let i = 0; i < 600; i++) send({ t: "commit", hunt: id }, `kaspatest:p${i}`, 2 + i);
    // Pointe à 1000, profondeur 100 : les scores ≤ 900 sont finaux (tous ici),
    // répartis sur deux pages de 500.
    expect(await indexer.sync()).toBe(601);
    expect(ledger.hunt(id)!.commits).toHaveLength(600);
  });
});

let server: Server | undefined;
afterEach(() => server?.close());

describe("GET /api/chain", () => {
  it("donne l'état des chasses sans aucune adresse", async () => {
    const { send, indexer } = fakeChain();
    const id = randomBytes(12).toString("hex");
    send(hunt(id), "kaspatest:alice-secret", 10);
    send({ t: "commit", hunt: id, threshold: 3 }, "kaspatest:bob-secret", 20);
    await indexer.sync();
    const app = await startApp({
      now: () => T0 + DAY,
      chain: { indexer, registryAddress: REGISTRY },
    });
    server = app.server;
    const status = await app.get("/api/chain/status");
    expect(status.body).toMatchObject({ registryAddress: REGISTRY, hunts: 1 });
    const list = await app.get("/api/chain/hunts");
    expect(list.body).toEqual([
      expect.objectContaining({ id, status: "active", commitCount: 1, commitsOpen: true }),
    ]);
    expect((await app.get(`/api/chain/hunts/${id}`)).body).toMatchObject({ id });
    expect((await app.get("/api/chain/hunts/inconnue")).status).toBe(404);
    expect(list.text + status.text).not.toContain("secret");
  });
});
