// Registre sur la chaîne : règles du grand livre.
// 1. Par défaut : chasses et engagements envoyés depuis un wallet.
// 2. En réserve : le pass (vraies preuves Semaphore, fichiers de public/zk).
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

import { Group } from "@semaphore-protocol/group";
import { Identity } from "@semaphore-protocol/identity";
import { generateProof } from "@semaphore-protocol/proof";
import { describe, expect, it } from "vitest";

import { PROOF_DEPTH } from "../services/semaphore.js";
import { byAddress, byPass, Ledger, type ChainEvent } from "./ledger.js";
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
