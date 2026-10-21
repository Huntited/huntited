// Index du registre : ordre, finalité, pagination, et routes publiques
// (aucune adresse renvoyée). Réseau simulé.
import { randomBytes } from "node:crypto";
import type { Server } from "node:http";

import { bytesToHex } from "@noble/hashes/utils.js";
import { afterEach, describe, expect, it } from "vitest";

import { decodeKaspaAddress } from "../services/kaspa-signature.js";
import { OUTCOME_GRACE_MS } from "../routes/chain.js";
import { makeWallet, startApp } from "../test-helpers.js";
import {
  ARCHIVE_FORMAT,
  ChainIndexer,
  parseArchive,
  type ChainSource,
  type RestTransaction,
} from "./indexer.js";
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
  // Transactions déjà envoyées mais que l'API ne liste pas encore (retard).
  const hidden = new Set<string>();
  const listed = () => txs.filter((t) => !hidden.has(t.transaction_id));
  const source: ChainSource = {
    virtualBlueScore: async () => tip,
    addressTransactionCount: async () => listed().length,
    // Plus récentes d'abord, comme l'API publique.
    addressTransactions: async (_a, offset, limit) =>
      listed()
        .sort((a, b) => (b.accepting_block_blue_score ?? 0) - (a.accepting_block_blue_score ?? 0))
        .slice(offset, offset + limit),
  };
  const send = (m: Message, sender: string, score: number, accepted = true, late = false) => {
    const id = `tx${String(++n).padStart(4, "0")}`;
    if (late) hidden.add(id);
    txs.push({
      transaction_id: id,
      is_accepted: accepted,
      accepting_block_blue_score: score,
      accepting_block_time: T0 + score,
      payload: bytesToHex(encodeMessage(m)),
      inputs: [{ previous_outpoint_address: sender }],
    });
  };
  const newLedger = () =>
    new Ledger({
      invitationKeys: [],
      minThreshold: 2,
      minCautionKas: 30,
      invitesPerMonth: 3,
      passRequired: false,
      releaseAddresses: [],
    });
  const indexer = new ChainIndexer(source, REGISTRY, newLedger, 100);
  return {
    send,
    indexer,
    setTip: (s: number) => (tip = s),
    /** L'API finit par lister les transactions en retard. */
    catchUp: () => hidden.clear(),
    /** L'API oublie tout l'historique (réinitialisation, vieux blocs effacés). */
    forget: () => txs.forEach((t) => hidden.add(t.transaction_id)),
    newLedger,
    source,
  };
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
    // Même valeur que dans le site (src/lib/chain.ts).
    expect(REGISTRY).toBe(
      "kaspatest:qr2ck8qnt0rtj7spzd7am9tsmtd5j4l3tgtah3tzz89l9jvcfg5uvc33cl3yj",
    );
    expect(REGISTRY.startsWith("kaspatest:")).toBe(true);
    expect(decodeKaspaAddress(REGISTRY).prefix).toBe("kaspatest");
    expect(registryAddress("kaspatest", `${REGISTRY_LABEL}-autre`)).not.toBe(REGISTRY);
  });
});

describe("archives du registre", () => {
  it("un index reconstruit le même état depuis une archive quand l'API a oublié", async () => {
    const { send, indexer, forget, newLedger, source } = fakeChain();
    const id = randomBytes(12).toString("hex");
    send(hunt(id), "kaspatest:alice", 100);
    send({ t: "commit", hunt: id }, "kaspatest:bob", 200);
    await indexer.sync();
    const archive = indexer.entries();
    expect(archive.map((e) => e.score)).toEqual([100, 200]);

    // L'API oublie ; un engagement récent arrive ensuite.
    forget();
    send({ t: "commit", hunt: id }, "kaspatest:carol", 300);
    const fresh = new ChainIndexer(source, REGISTRY, newLedger, 100);
    await fresh.sync();
    expect(fresh.ledger.hunt(id)).toBeUndefined(); // sans archive : chasse perdue

    // Avec l'archive (même chargée après coup) : tout est rejoué dans l'ordre.
    expect(await fresh.seed(archive)).toBe(2);
    expect(await fresh.seed(archive)).toBe(0); // rien de nouveau
    const h = fresh.ledger.hunt(id)!;
    expect(h.commits.map((c) => c.who)).toEqual(["a:kaspatest:bob", "a:kaspatest:carol"]);
    expect(h.activatedAt).toBe(T0 + 300);
    expect(fresh.entries()).toHaveLength(3);
  });

  it("n'accepte qu'un fichier du bon format, pour ce registre", () => {
    const entry = {
      txId: "ab".repeat(32),
      score: 5,
      time: T0,
      sender: "kaspatest:alice",
      payload: "484e5431",
    };
    const doc = { format: ARCHIVE_FORMAT, version: 1, registry: REGISTRY, entries: [entry] };
    expect(parseArchive(doc, REGISTRY)).toEqual([entry]);
    expect(parseArchive({ ...doc, registry: "kaspatest:autre" }, REGISTRY)).toEqual([]);
    expect(parseArchive({ ...doc, format: "x" }, REGISTRY)).toEqual([]);
    expect(parseArchive(null, REGISTRY)).toEqual([]);
    // Entrées mal formées ignorées une à une.
    const bad = [
      { ...entry, txId: "zz" },
      { ...entry, score: -1 },
      { ...entry, payload: "abc" },
      { ...entry, sender: "" },
    ];
    expect(parseArchive({ ...doc, entries: [...bad, entry] }, REGISTRY)).toEqual([entry]);
  });
});

describe("index", () => {
  it("rejoue dans l'ordre de la chaîne, seulement les transactions finales", async () => {
    const { send, indexer, setTip } = fakeChain();
    const id = randomBytes(12).toString("hex");
    // Arrivées dans le désordre : l'engagement d'Alice avant la chasse (score plus bas)
    // doit être refusé ; celui de Bob, après, accepté.
    send({ t: "commit", hunt: id }, "kaspatest:bob", 300);
    send(hunt(id), "kaspatest:alice", 200);
    send({ t: "commit", hunt: id }, "kaspatest:alice", 150);
    send({ t: "commit", hunt: id }, "kaspatest:carol", 250, false); // non acceptée
    send({ t: "commit", hunt: id }, "kaspatest:dave", 950); // pas encore finale

    expect(await indexer.sync()).toBe(3);
    const h = indexer.ledger.hunt(id)!;
    expect(h.commits.map((c) => c.who)).toEqual(["a:kaspatest:bob"]);
    expect(indexer.appliedScore()).toBe(300);

    // Plus tard : l'engagement de Dave devient final.
    setTip(1_100);
    expect(await indexer.sync()).toBe(1);
    expect(h.commits).toHaveLength(2);
    expect(h.activatedAt).toBe(T0 + 950);
    expect(await indexer.sync()).toBe(0);
  });

  it("une transaction listée en retard par l'API est rejouée à sa place", async () => {
    const { send, indexer, catchUp } = fakeChain();
    const id = randomBytes(12).toString("hex");
    send(hunt(id), "kaspatest:alice", 100, true, true); // la chasse : en retard
    send({ t: "commit", hunt: id }, "kaspatest:bob", 200);
    send({ t: "commit", hunt: id }, "kaspatest:carol", 300);

    // Sans la chasse, les engagements visent une chasse inconnue.
    await indexer.sync();
    expect(indexer.ledger.hunt(id)).toBeUndefined();

    // L'API rattrape son retard : tout est recalculé dans l'ordre de la chaîne.
    catchUp();
    expect(await indexer.sync()).toBe(1);
    const h = indexer.ledger.hunt(id)!;
    expect(h.commits.map((c) => c.who)).toEqual(["a:kaspatest:bob", "a:kaspatest:carol"]);
    expect(h.activatedAt).toBe(T0 + 300);
  });

  it("parcourt plusieurs pages", async () => {
    const { send, indexer } = fakeChain();
    const id = randomBytes(12).toString("hex");
    send(hunt(id), "kaspatest:alice", 1);
    for (let i = 0; i < 600; i++) send({ t: "commit", hunt: id }, `kaspatest:p${i}`, 2 + i);
    // Pointe à 1000, profondeur 100 : les scores ≤ 900 sont finaux (tous ici),
    // répartis sur deux pages de 500.
    expect(await indexer.sync()).toBe(601);
    expect(indexer.ledger.hunt(id)!.commits).toHaveLength(600);
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

  it("échec annoncé seulement après le délai de vérification", async () => {
    const { send, indexer } = fakeChain();
    const id = randomBytes(12).toString("hex");
    send(hunt(id), "kaspatest:alice", 10);
    await indexer.sync();
    let now = T0 + 7 * DAY + 60_000; // une minute après la date limite
    const app = await startApp({ now: () => now, chain: { indexer, registryAddress: REGISTRY } });
    server = app.server;
    expect((await app.get(`/api/chain/hunts/${id}`)).body).toMatchObject({
      status: "active",
      commitsOpen: false,
      outcomePending: true,
    });
    now += OUTCOME_GRACE_MS;
    const after = (await app.get(`/api/chain/hunts/${id}`)).body;
    expect(after).toMatchObject({ status: "settled", outcome: "failure" });
    expect(after["outcomePending"]).toBeUndefined();
  });

  it("chat : créateur et engagé·es d'une chasse sur la chaîne, reconnus par leur wallet", async () => {
    const { send, indexer } = fakeChain();
    const [alice, bob, carol, eve] = [makeWallet(), makeWallet(), makeWallet(), makeWallet()];
    const id = randomBytes(12).toString("hex");
    // Échéance dans le futur réel : le salon refuse une expiration déjà passée.
    const deadline = Date.now() + 7 * DAY;
    send({ ...hunt(id), deadline } as Message, alice.address, 10);
    send({ t: "commit", hunt: id }, bob.address, 20);
    send({ t: "commit", hunt: id }, carol.address, 30); // seuil 2 atteint : déclenchée
    await indexer.sync();
    const app = await startApp({
      now: () => T0 + DAY,
      chain: { indexer, registryAddress: REGISTRY },
    });
    server = app.server;
    const access = async (w: ReturnType<typeof makeWallet>) =>
      app.post("/api/auth/chat-access", { huntId: id }, await app.login(w));
    expect((await access(alice)).status).toBe(200);
    const bobToken = (await access(bob)).body["accessToken"] as string;
    expect(typeof bobToken).toBe("string");
    expect((await access(eve)).status).toBe(401);
    // Le salon s'ouvre, avec le nom et l'expiration tirés de la chaîne.
    const chat = await app.post(
      "/api/chats",
      { huntId: id, huntName: "x", expiresAt: Date.now() + 10 * 365 * DAY },
      bobToken,
    );
    expect(chat.status).toBe(201);
    expect(chat.body["expiresAt"]).toBe(deadline + DAY);
  });
});
