// Registre sur la chaîne : règles du grand livre, avec de vraies preuves
// Semaphore (fichiers de calcul de public/zk) et de vraies signatures.
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

import { Group } from "@semaphore-protocol/group";
import { Identity } from "@semaphore-protocol/identity";
import { generateProof } from "@semaphore-protocol/proof";
import { describe, expect, it } from "vitest";

import { PROOF_DEPTH } from "../services/semaphore.js";
import { Ledger, type ChainEvent } from "./ledger.js";
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
  type HuntMessage,
  type Message,
} from "./protocol.js";

const zk = (f: string) => fileURLToPath(new URL(`../../../public/zk/${f}`, import.meta.url));
const ARTIFACTS = { wasm: zk("semaphore-20.wasm"), zkey: zk("semaphore-20.zkey") };

const code = () => randomBytes(32).toString("hex");
const T0 = Date.UTC(2026, 9, 7, 12);
const DAY = 86_400_000;

function setup() {
  const genesisCodes = [code(), code()];
  const ledger = new Ledger({
    invitationKeys: genesisCodes.map(invitationKey),
    minThreshold: 2,
    minCautionKas: 30,
    invitesPerMonth: 3,
  });
  let n = 0;
  const events: ChainEvent[] = [];
  const publish = (m: Message, time: number) => {
    const e = { txId: `tx${++n}`, time, payload: encodeMessage(m) };
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
  return { ledger, genesisCodes, publish, prove, join, events };
}

describe("format des messages", () => {
  it("encode et relit un message ; ignore tout le reste", () => {
    const m: Message = { t: "pass", key: "a".repeat(64), commitment: "123", sig: "b".repeat(128) };
    expect(decodeMessage(encodeMessage(m))).toEqual(m);
    expect(decodeMessage(new TextEncoder().encode("hello"))).toBeNull();
    expect(decodeMessage(new TextEncoder().encode('HNT1{"t":"pass"}'))).toBeNull();
    expect(decodeMessage(new Uint8Array([0xff, 0xfe]))).toBeNull();
  });
});

describe("grand livre", () => {
  it("pass, invitations, chasse, engagements, rôles et issue", { timeout: 60_000 }, async () => {
    const { ledger, genesisCodes, publish, prove, join, events } = setup();
    const alice = new Identity();
    const bob = new Identity();
    const carol = new Identity();

    // Invitations de départ : une seule fois chacune.
    expect(await join(genesisCodes[0]!, alice)).toEqual({ ok: true, type: "pass" });
    expect(await join(genesisCodes[0]!, new Identity())).toMatchObject({ ok: false });
    expect(await join(genesisCodes[1]!, bob)).toMatchObject({ ok: true });

    // Alice invite Carol (preuve anonyme, quota mensuel).
    const invite = code();
    const scope = inviteScope(monthOf(T0), 1);
    const key = invitationKey(invite);
    const proof = await prove(alice, scope, inviteDigest(key));
    expect(await publish({ t: "invite", key, slot: 1, proof }, T0)).toMatchObject({ ok: true });
    // Même emplacement réutilisé : refusé.
    const again = await prove(alice, scope, inviteDigest(invitationKey(code())));
    expect(
      await publish({ t: "invite", key: invitationKey(code()), slot: 1, proof: again }, T0),
    ).toEqual({ ok: false, reason: "slot_used" });

    // Quelqu'un qui voit passer l'invitation ne peut pas la voler : la
    // signature ne couvre que le pass de Carol.
    const thief = new Identity().commitment.toString();
    const stolen = signRedeem(invite, carol.commitment.toString());
    expect(await publish({ t: "pass", key, commitment: thief, sig: stolen }, T0)).toEqual({
      ok: false,
      reason: "invalid_signature",
    });
    expect(await join(invite, carol)).toMatchObject({ ok: true });

    // Alice crée une chasse ; le relais ne peut pas en changer le contenu.
    const content: Omit<HuntMessage, "t" | "proof"> = {
      id: randomBytes(12).toString("hex"),
      title: "Conseil municipal",
      description: "On y va ensemble",
      location: "Mairie",
      country: "FR",
      deadline: T0 + 7 * DAY,
      threshold: 2,
      deposit: 30,
      progressVisibility: "visible",
    };
    const huntProof = await prove(alice, createScope(content.id), huntDigest(content));
    expect(
      await publish({ t: "hunt", ...content, title: "Autre chose", proof: huntProof }, T0),
    ).toEqual({ ok: false, reason: "invalid_proof" });
    expect(await publish({ t: "hunt", ...content, proof: huntProof }, T0 + 1)).toMatchObject({
      ok: true,
    });
    const id = content.id;

    // Engagements : Bob (seuil 2), Carol (seuil 3) ; Bob ne peut pas s'engager deux fois.
    const bobProof = await prove(bob, huntScope(id), 2);
    expect(await publish({ t: "commit", hunt: id, proof: bobProof }, T0 + DAY)).toMatchObject({
      ok: true,
    });
    expect(await publish({ t: "commit", hunt: id, proof: bobProof }, T0 + DAY)).toMatchObject({
      ok: false,
    });
    const carolProof = await prove(carol, huntScope(id), 3);
    await publish({ t: "commit", hunt: id, proof: carolProof }, T0 + 2 * DAY);
    const h = ledger.hunt(id)!;
    expect(h.commits).toHaveLength(2);
    expect(ledger.status(h, T0 + 3 * DAY)).toEqual({ status: "active" });

    // Alice s'engage aussi (seuil 2) : 3 engagés → groupe retenu, activation.
    await publish(
      { t: "commit", hunt: id, proof: await prove(alice, huntScope(id), 2) },
      T0 + 3 * DAY,
    );
    expect(ledger.retainedGroup(h)).toEqual({ retainedThreshold: 3, retainedCount: 3 });
    expect(h.activatedAt).toBe(T0 + 3 * DAY);
    expect(ledger.status(h, T0 + 8 * DAY)).toEqual({ status: "activated", outcome: "success" });

    // Rôles, reconnus par les preuves (jamais par un wallet).
    expect(ledger.roleOf(id, huntProof.nullifier)).toBe("creator");
    expect(ledger.roleOf(id, bobProof.nullifier)).toBe("participant");
    expect(ledger.roleOf(id, "123")).toBeUndefined();

    // Après la date limite : fermé.
    const late = await prove(new Identity(), huntScope(id), 2).catch(() => null);
    expect(late).toBeNull(); // (identité hors du groupe : preuve impossible)
    const lateProof = await prove(carol, huntScope(id), 2);
    expect(
      await publish({ t: "commit", hunt: id, proof: lateProof }, content.deadline + 1),
    ).toEqual({ ok: false, reason: "closed" });

    // Déterminisme : un autre index qui relit les mêmes transactions obtient le même état.
    const other = new Ledger({
      invitationKeys: genesisCodes.map(invitationKey),
      minThreshold: 2,
      minCautionKas: 30,
      invitesPerMonth: 3,
    });
    for (const e of events) await other.apply(e);
    expect(other.allHunts()).toEqual(ledger.allHunts());
    expect(other.memberCommitments()).toEqual(ledger.memberCommitments());
  });

  it("chasse ratée : issue « échec » après la date limite", { timeout: 30_000 }, async () => {
    const { ledger, genesisCodes, publish, prove, join } = setup();
    const alice = new Identity();
    await join(genesisCodes[0]!, alice);
    const content: Omit<HuntMessage, "t" | "proof"> = {
      id: randomBytes(12).toString("hex"),
      title: "Nettoyage",
      description: "Parc",
      location: "Lyon",
      deadline: T0 + DAY,
      threshold: 5,
      deposit: 30,
      progressVisibility: "hidden",
    };
    const proof = await prove(alice, createScope(content.id), huntDigest(content));
    await publish({ t: "hunt", ...content, proof }, T0);
    const h = ledger.hunt(content.id)!;
    expect(ledger.status(h, T0 + 2 * DAY)).toEqual({ status: "expired", outcome: "failure" });
    // Règles du registre : seuil trop bas refusé.
    const low = { ...content, id: randomBytes(12).toString("hex"), threshold: 1 };
    const lowProof = await prove(alice, createScope(low.id), huntDigest(low));
    expect(await publish({ t: "hunt", ...low, proof: lowProof }, T0)).toEqual({
      ok: false,
      reason: "threshold_too_low",
    });
  });
});
