// Registre sur la chaîne : règles du grand livre.
// 1. Par défaut : chasses et engagements envoyés depuis un wallet.
// 2. En réserve : le pass (vraies preuves Semaphore, fichiers de public/zk).
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

import { schnorr } from "@noble/curves/secp256k1.js";
import { Group } from "@semaphore-protocol/group";
import { Identity } from "@semaphore-protocol/identity";
import { generateProof } from "@semaphore-protocol/proof";
import { describe, expect, it } from "vitest";

import { PROOF_DEPTH } from "../services/semaphore.js";
import { byAddress, byPass, byPlace, Ledger, type ChainEvent } from "./ledger.js";
import {
  createScope,
  decodeMessage,
  encodeMessage,
  huntDigest,
  huntScope,
  invitationKey,
  inviteDigest,
  inviteScope,
  monthOf,
  signPlaceCommit,
  signPlaceWithdraw,
  signRedeem,
  type Genesis,
  type HuntMessage,
  type Message,
} from "./protocol.js";

const zk = (f: string) => fileURLToPath(new URL(`../../../public/zk/${f}`, import.meta.url));
const ARTIFACTS = { wasm: zk("semaphore-20.wasm"), zkey: zk("semaphore-20.zkey") };

const code = () => randomBytes(32).toString("hex");
const T0 = Date.UTC(2026, 9, 7, 12);
const DAY = 86_400_000;

function setup(over: Partial<Genesis> = {}) {
  const genesisCodes = [code(), code()];
  const genesis: Genesis = {
    invitationKeys: genesisCodes.map(invitationKey),
    minThreshold: 2,
    minCautionKas: 30,
    invitesPerMonth: 3,
    passRequired: false,
    releaseAddresses: ["kaspatest:publication"],
    ...over,
  };
  const ledger = new Ledger(genesis);
  let n = 0;
  const events: ChainEvent[] = [];
  const publish = (m: Message, time: number, sender = "kaspatest:relais") => {
    const e = { txId: `tx${++n}`, time, sender, payload: encodeMessage(m) };
    events.push(e);
    return ledger.apply(e);
  };
  const prove = (id: Identity, scope: string, message: string | number) =>
    generateProof(
      id,
      new Group(ledger.memberCommitments().map(BigInt)),
      message,
      scope,
      PROOF_DEPTH,
      ARTIFACTS,
    );
  const join = (invite: string, id: Identity, time = T0) => {
    const commitment = id.commitment.toString();
    return publish(
      { t: "pass", key: invitationKey(invite), commitment, sig: signRedeem(invite, commitment) },
      time,
    );
  };
  const replay = async () => {
    const other = new Ledger(genesis);
    for (const e of events) await other.apply(e);
    return other;
  };
  return { ledger, genesisCodes, publish, prove, join, replay };
}

const huntContent = (over: Partial<Omit<HuntMessage, "t" | "proof">> = {}) => ({
  id: randomBytes(12).toString("hex"),
  title: "Conseil municipal",
  description: "On y va ensemble",
  location: "Mairie",
  country: "FR",
  deadline: T0 + 7 * DAY,
  threshold: 2,
  deposit: 30,
  progressVisibility: "visible" as const,
  ...over,
});

describe("format des messages", () => {
  it("encode et relit un message ; ignore tout le reste", () => {
    const m: Message = { t: "commit", hunt: "a".repeat(24), threshold: 9 };
    expect(decodeMessage(encodeMessage(m))).toEqual(m);
    expect(decodeMessage(new TextEncoder().encode("hello"))).toBeNull();
    expect(decodeMessage(new TextEncoder().encode('HNT1{"t":"commit"}'))).toBeNull();
    expect(decodeMessage(new Uint8Array([0xff, 0xfe]))).toBeNull();
  });
});

describe("grand livre : wallets (par défaut)", () => {
  const ALICE = "kaspatest:alice";
  const BOB = "kaspatest:bob";
  const CAROL = "kaspatest:carol";

  it("n'importe quel wallet crée et rejoint une chasse", async () => {
    const { ledger, publish, replay } = setup();
    const content = huntContent();
    const id = content.id;
    expect(await publish({ t: "hunt", ...content }, T0, ALICE)).toEqual({ ok: true, type: "hunt" });
    expect(await publish({ t: "hunt", ...content }, T0, BOB)).toEqual({
      ok: false,
      reason: "hunt_exists",
    });

    // Bob (seuil de la chasse), Carol (seuil personnel 3) ; un wallet = un engagement.
    expect(await publish({ t: "commit", hunt: id }, T0 + DAY, BOB)).toMatchObject({ ok: true });
    expect(await publish({ t: "commit", hunt: id, threshold: 5 }, T0 + DAY, BOB)).toEqual({
      ok: false,
      reason: "already_committed",
    });
    expect(await publish({ t: "commit", hunt: id, threshold: 1 }, T0 + DAY, CAROL)).toEqual({
      ok: false,
      reason: "invalid_threshold",
    });
    await publish({ t: "commit", hunt: id, threshold: 3 }, T0 + 2 * DAY, CAROL);
    const h = ledger.hunt(id)!;
    expect(ledger.status(h, T0 + 2 * DAY)).toEqual({ status: "active" });

    // Alice s'engage aussi : groupe retenu de 3, activation.
    await publish({ t: "commit", hunt: id }, T0 + 3 * DAY, ALICE);
    expect(ledger.retainedGroup(h)).toEqual({ retainedThreshold: 3, retainedCount: 3 });
    expect(h.activatedAt).toBe(T0 + 3 * DAY);
    expect(h.activationRank).toBe(3);
    expect(ledger.status(h, T0 + 8 * DAY)).toEqual({ status: "activated", outcome: "success" });

    // Rôles, d'après l'adresse qui a envoyé la transaction.
    expect(ledger.roleOf(id, byAddress(ALICE))).toBe("creator");
    expect(ledger.roleOf(id, byAddress(BOB))).toBe("participant");
    expect(ledger.roleOf(id, byAddress("kaspatest:inconnu"))).toBeUndefined();

    // Après la date limite : fermé.
    expect(
      await publish({ t: "commit", hunt: id }, content.deadline + 1, "kaspatest:dave"),
    ).toEqual({ ok: false, reason: "closed" });

    // Un autre index qui relit les mêmes transactions obtient le même état.
    expect((await replay()).allHunts()).toEqual(ledger.allHunts());
  });

  it("règles du registre et chasse ratée", async () => {
    const { ledger, publish } = setup();
    const low = huntContent({ threshold: 1 });
    expect(await publish({ t: "hunt", ...low }, T0, ALICE)).toEqual({
      ok: false,
      reason: "threshold_too_low",
    });
    const cheap = huntContent({ deposit: 10 });
    expect(await publish({ t: "hunt", ...cheap }, T0, ALICE)).toEqual({
      ok: false,
      reason: "caution_too_low",
    });
    const past = huntContent({ deadline: T0 - 1 });
    expect(await publish({ t: "hunt", ...past }, T0, ALICE)).toEqual({
      ok: false,
      reason: "invalid_deadline",
    });
    const content = huntContent({ deadline: T0 + DAY, threshold: 5 });
    await publish({ t: "hunt", ...content }, T0, ALICE);
    await publish({ t: "commit", hunt: content.id }, T0 + 1, BOB);
    expect(ledger.status(ledger.hunt(content.id)!, T0 + 2 * DAY)).toEqual({
      status: "expired",
      outcome: "failure",
    });
  });
});

describe("grand livre : retrait et chasses enchaînées", () => {
  const ALICE = "kaspatest:alice";
  const BOB = "kaspatest:bob";
  const CAROL = "kaspatest:carol";

  it("on se retire avant le déclenchement, jamais après ; on peut revenir", async () => {
    const { ledger, publish, replay } = setup();
    const content = huntContent({ threshold: 3 });
    const id = content.id;
    await publish({ t: "hunt", ...content }, T0, ALICE);
    await publish({ t: "commit", hunt: id }, T0 + 1, BOB);
    await publish({ t: "commit", hunt: id }, T0 + 2, CAROL);
    expect(await publish({ t: "withdraw", hunt: id }, T0 + 3, BOB)).toEqual({
      ok: true,
      type: "withdraw",
    });
    expect(await publish({ t: "withdraw", hunt: id }, T0 + 4, BOB)).toEqual({
      ok: false,
      reason: "not_committed",
    });
    // Bob ne compte plus : Alice seule ne déclenche pas.
    await publish({ t: "commit", hunt: id }, T0 + 5, ALICE);
    expect(ledger.hunt(id)!.activatedAt).toBeUndefined();
    // Bob revient : déclenchement ; plus aucun retrait possible.
    await publish({ t: "commit", hunt: id }, T0 + 6, BOB);
    expect(ledger.hunt(id)!.activatedAt).toBe(T0 + 6);
    expect(await publish({ t: "withdraw", hunt: id }, T0 + 7, CAROL)).toEqual({
      ok: false,
      reason: "activated",
    });
    expect((await replay()).allHunts()).toEqual(ledger.allHunts());
  });

  it("une place de pass de groupe se retire avec sa signature", async () => {
    const { ledger, publish } = setup();
    const content = huntContent({ threshold: 3 });
    const placeKey = code();
    const place = Buffer.from(schnorr.getPublicKey(Buffer.from(placeKey, "hex"))).toString("hex");
    await publish({ t: "hunt", ...content }, T0, ALICE);
    await publish({ t: "places", hunt: content.id, keys: [place] }, T0 + 1, BOB);
    const sig = signPlaceCommit(placeKey, content.id, {});
    await publish({ t: "gcommit", hunt: content.id, entries: [{ place, sig }] }, T0 + 2, BOB);
    expect(ledger.place(place)?.used).toBe(true);
    const bad = { t: "withdraw" as const, hunt: content.id, place, sig: "0".repeat(128) };
    expect(await publish(bad, T0 + 3, CAROL)).toEqual({ ok: false, reason: "invalid_signature" });
    const ok = { ...bad, sig: signPlaceWithdraw(placeKey, content.id) };
    expect(await publish(ok, T0 + 4, CAROL)).toEqual({ ok: true, type: "withdraw" });
    expect(ledger.place(place)?.used).toBe(false);
  });

  it("un engagement conditionnel compte quand l'autre chasse se déclenche", async () => {
    const { ledger, publish, replay } = setup();
    const a = huntContent({ threshold: 2 });
    const b = huntContent({ threshold: 2 });
    await publish({ t: "hunt", ...a }, T0, ALICE);
    await publish({ t: "hunt", ...b }, T0, ALICE);
    expect(await publish({ t: "commit", hunt: b.id, after: b.id }, T0 + 1, BOB)).toEqual({
      ok: false,
      reason: "invalid_condition",
    });
    expect(await publish({ t: "commit", hunt: b.id, after: "f".repeat(24) }, T0 + 1, BOB)).toEqual({
      ok: false,
      reason: "invalid_condition",
    });
    // B : deux engagements « seulement si A se déclenche ».
    await publish({ t: "commit", hunt: b.id, after: a.id }, T0 + 2, BOB);
    await publish({ t: "commit", hunt: b.id, after: a.id }, T0 + 3, CAROL);
    expect(ledger.hunt(b.id)!.activatedAt).toBeUndefined();
    expect(ledger.retainedGroup(ledger.hunt(b.id)!).retainedCount).toBe(0);
    expect(ledger.roleOf(b.id, byAddress(BOB))).toBeUndefined();
    // A se déclenche : B se déclenche au même moment.
    await publish({ t: "commit", hunt: a.id }, T0 + 4, BOB);
    await publish({ t: "commit", hunt: a.id }, T0 + 5, CAROL);
    expect(ledger.hunt(a.id)!.activatedAt).toBe(T0 + 5);
    expect(ledger.hunt(b.id)!.activatedAt).toBe(T0 + 5);
    expect(ledger.roleOf(b.id, byAddress(BOB))).toBe("participant");
    expect((await replay()).allHunts()).toEqual(ledger.allHunts());
  });
});

describe("grand livre : versions du site", () => {
  it("seule l'adresse de publication ancre une version, une fois par numéro", async () => {
    const { ledger, publish } = setup();
    const release = (version: string) =>
      ({ t: "release", version, manifest: "a".repeat(64) }) as const;
    expect(await publish(release("1.0.0"), T0, "kaspatest:imposteur")).toEqual({
      ok: false,
      reason: "not_publisher",
    });
    expect(await publish(release("1.0.0"), T0, "kaspatest:publication")).toEqual({
      ok: true,
      type: "release",
    });
    expect(await publish(release("1.0.0"), T0 + 1, "kaspatest:publication")).toEqual({
      ok: false,
      reason: "version_exists",
    });
    expect(ledger.releases()).toEqual([
      { version: "1.0.0", manifest: "a".repeat(64), at: T0, txId: "tx2" },
    ]);
  });
});

describe("grand livre : pass de groupe", () => {
  const placeKey = () => randomBytes(32).toString("hex");
  const pub = (k: string) =>
    Buffer.from(schnorr.getPublicKey(Buffer.from(k, "hex"))).toString("hex");

  it("l'association inscrit des places ; les membres s'engagent par lot, sans wallet", async () => {
    const { ledger, publish } = setup();
    const content = huntContent({ threshold: 2 });
    await publish({ t: "hunt", ...content }, T0, "kaspatest:createur");
    const [k1, k2, k3, autre] = [placeKey(), placeKey(), placeKey(), placeKey()];
    expect(
      await publish(
        { t: "places", hunt: content.id, keys: [pub(k1), pub(k2), pub(k3)] },
        T0 + 1,
        "kaspatest:asso",
      ),
    ).toEqual({ ok: true, type: "places" });
    // Déjà inscrites : rien de nouveau.
    expect(
      await publish({ t: "places", hunt: content.id, keys: [pub(k1)] }, T0 + 2, "kaspatest:autre"),
    ).toEqual({ ok: false, reason: "places_exist" });
    expect(ledger.place(pub(k1))).toEqual({
      hunt: content.id,
      sponsor: "kaspatest:asso",
      used: false,
    });

    const entry = (
      k: string,
      e: { threshold?: number; chat?: string } = {},
      hunt = content.id,
    ) => ({
      place: pub(k),
      ...e,
      sig: signPlaceCommit(k, hunt, e),
    });
    const chat = "cc".repeat(32);
    expect(
      await publish(
        {
          t: "gcommit",
          hunt: content.id,
          entries: [
            entry(k1, { chat }),
            entry(k2, { threshold: 2 }),
            entry(autre), // place non inscrite : ignorée
            { ...entry(k3), sig: entry(k3, {}, "ff".repeat(12)).sig }, // signée pour une autre chasse
          ],
        },
        T0 + 3,
        "kaspatest:asso",
      ),
    ).toEqual({ ok: true, type: "gcommit" });
    const h = ledger.hunt(content.id)!;
    expect(h.commits.map((c) => c.who)).toEqual([byPlace(pub(k1)), byPlace(pub(k2))]);
    expect(h.commits[0]!.chat).toBe(chat);
    expect(h.commits[1]!.personalThreshold).toBe(2);
    expect(ledger.place(pub(k1))!.used).toBe(true);
    // Seuil 2 atteint par les deux places : chasse déclenchée.
    expect(h.activatedAt).toBe(T0 + 3);
    // Une place ne sert qu'une fois ; une signature modifiée ne passe pas.
    expect(
      await publish(
        { t: "gcommit", hunt: content.id, entries: [entry(k1), { ...entry(k3), threshold: 9 }] },
        T0 + 4,
      ),
    ).toEqual({ ok: false, reason: "no_valid_entry" });
    // Après la date limite : fermé.
    expect(
      await publish({ t: "gcommit", hunt: content.id, entries: [entry(k3)] }, content.deadline + 1),
    ).toEqual({ ok: false, reason: "closed" });
  });
});

describe("grand livre : modération", () => {
  it("seule l'adresse de publication masque ou réaffiche une chasse", async () => {
    const { ledger, publish } = setup();
    const id = "ab".repeat(12);
    const hide = { t: "hide", hunt: id, reason: "spam" } as const;
    expect(await publish(hide, T0, "kaspatest:imposteur")).toEqual({
      ok: false,
      reason: "not_publisher",
    });
    expect(ledger.hidden(id)).toBeUndefined();
    expect(await publish(hide, T0, "kaspatest:publication")).toEqual({ ok: true, type: "hide" });
    expect(ledger.hidden(id)).toMatchObject({ hunt: id, reason: "spam", at: T0 });
    expect(await publish({ t: "unhide", hunt: id }, T0 + 1, "kaspatest:imposteur")).toEqual({
      ok: false,
      reason: "not_publisher",
    });
    expect(await publish({ t: "unhide", hunt: id }, T0 + 1, "kaspatest:publication")).toEqual({
      ok: true,
      type: "unhide",
    });
    expect(ledger.hiddenHunts()).toEqual([]);
    expect(await publish({ t: "unhide", hunt: id }, T0 + 2, "kaspatest:publication")).toEqual({
      ok: false,
      reason: "not_hidden",
    });
  });
});

describe("grand livre : pass (en réserve)", () => {
  it(
    "anonymat complet : invitations, chasse et engagements par preuves",
    { timeout: 60_000 },
    async () => {
      const { ledger, genesisCodes, publish, prove, join, replay } = setup({ passRequired: true });
      const alice = new Identity();
      const bob = new Identity();
      const carol = new Identity();

      // Invitations de départ : une seule fois chacune.
      expect(await join(genesisCodes[0]!, alice)).toEqual({ ok: true, type: "pass" });
      expect(await join(genesisCodes[0]!, new Identity())).toMatchObject({ ok: false });
      expect(await join(genesisCodes[1]!, bob)).toMatchObject({ ok: true });

      // Alice invite Carol (preuve anonyme, quota mensuel) ; emplacement réutilisé : refusé.
      const invite = code();
      const scope = inviteScope(monthOf(T0), 1);
      const key = invitationKey(invite);
      expect(
        await publish(
          { t: "invite", key, slot: 1, proof: await prove(alice, scope, inviteDigest(key)) },
          T0,
        ),
      ).toMatchObject({ ok: true });
      const other = invitationKey(code());
      expect(
        await publish(
          {
            t: "invite",
            key: other,
            slot: 1,
            proof: await prove(alice, scope, inviteDigest(other)),
          },
          T0,
        ),
      ).toEqual({ ok: false, reason: "slot_used" });

      // Une invitation vue en route ne peut pas être volée : la signature ne
      // couvre que le pass de Carol.
      const thief = new Identity().commitment.toString();
      const sig = signRedeem(invite, carol.commitment.toString());
      expect(await publish({ t: "pass", key, commitment: thief, sig }, T0)).toEqual({
        ok: false,
        reason: "invalid_signature",
      });
      expect(await join(invite, carol)).toMatchObject({ ok: true });

      // Pass exigé : sans preuve, refusé. Avec : contenu scellé (le relais ne peut rien changer).
      const content = huntContent();
      const id = content.id;
      expect(await publish({ t: "hunt", ...content }, T0)).toEqual({
        ok: false,
        reason: "pass_required",
      });
      const huntProof = await prove(alice, createScope(id), huntDigest(content));
      expect(
        await publish({ t: "hunt", ...content, title: "Autre", proof: huntProof }, T0),
      ).toEqual({ ok: false, reason: "invalid_proof" });
      expect(await publish({ t: "hunt", ...content, proof: huntProof }, T0 + 1)).toMatchObject({
        ok: true,
      });

      // Engagements par preuve : une personne = un engagement, quel que soit le relais.
      const bobProof = await prove(bob, huntScope(id), 2);
      expect(await publish({ t: "commit", hunt: id, proof: bobProof }, T0 + DAY)).toMatchObject({
        ok: true,
      });
      expect(
        await publish(
          { t: "commit", hunt: id, proof: bobProof },
          T0 + DAY,
          "kaspatest:autre-relais",
        ),
      ).toEqual({ ok: false, reason: "already_committed" });
      expect(await publish({ t: "commit", hunt: id }, T0 + DAY, "kaspatest:x")).toEqual({
        ok: false,
        reason: "pass_required",
      });
      await publish(
        { t: "commit", hunt: id, proof: await prove(carol, huntScope(id), 2) },
        T0 + DAY,
      );
      expect(ledger.hunt(id)!.activatedAt).toBe(T0 + DAY);

      // Rôles par les preuves, jamais par un wallet.
      expect(ledger.roleOf(id, byPass(huntProof.nullifier))).toBe("creator");
      expect(ledger.roleOf(id, byPass(bobProof.nullifier))).toBe("participant");
      expect(ledger.roleOf(id, byAddress("kaspatest:relais"))).toBeUndefined();

      const again = await replay();
      expect(again.allHunts()).toEqual(ledger.allHunts());
      expect(again.memberCommitments()).toEqual(ledger.memberCommitments());
    },
  );
});
