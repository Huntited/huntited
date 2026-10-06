// Pass Huntited : invitations, groupe anonyme, une personne = un engagement.
// Preuves Semaphore réelles (fichiers de calcul de public/zk).
import type { Server } from "node:http";
import { fileURLToPath } from "node:url";

import { Group } from "@semaphore-protocol/group";
import { Identity } from "@semaphore-protocol/identity";
import { generateProof } from "@semaphore-protocol/proof";
import { afterEach, describe, expect, it } from "vitest";

import { huntScope, inviteScope, PROOF_DEPTH } from "../services/semaphore.js";
import { makeWallet, startApp } from "../test-helpers.js";

const zk = (f: string) => fileURLToPath(new URL(`../../../public/zk/${f}`, import.meta.url));
const ARTIFACTS = { wasm: zk("semaphore-20.wasm"), zkey: zk("semaphore-20.zkey") };
const GENESIS = ["genesis-code-aaaaaaaaaaaaaaaaaaaa", "genesis-code-bbbbbbbbbbbbbbbbbbbb"];

let server: Server | undefined;
afterEach(() => server?.close());

async function setup(required = true) {
  const app = await startApp({ passes: { required, genesis: GENESIS } });
  server = app.server;
  const group = async () =>
    new Group(((await app.get("/api/passes/group")).body["members"] as string[]).map(BigInt));
  const prove = async (id: Identity, scope: string, message: number | string = 0) =>
    generateProof(id, await group(), message, scope, PROOF_DEPTH, ARTIFACTS);
  const join = (invitation: string, id: Identity) =>
    app.post("/api/passes/redeem", { invitation, commitment: id.commitment.toString() });
  return { app, prove, join };
}

describe("pass Huntited", () => {
  it("annonce la configuration", async () => {
    const { app } = await setup();
    expect((await app.get("/api/passes/config")).body).toEqual({
      required: true,
      invitesPerMonth: 3,
    });
  });

  it("une invitation de départ s'utilise une seule fois", async () => {
    const { app, join } = await setup();
    expect((await join(GENESIS[0]!, new Identity())).status).toBe(201);
    expect((await join(GENESIS[0]!, new Identity())).body).toMatchObject({
      code: "invalid_invitation",
    });
    expect((await join("pas-une-invitation-valable", new Identity())).status).toBe(400);
    expect((await app.get("/api/passes/group")).body["members"]).toHaveLength(1);
  });

  it("un membre invite anonymement, dans la limite de 3 par mois", async () => {
    const { app, prove, join } = await setup();
    const alice = new Identity();
    await join(GENESIS[0]!, alice);

    const scope = inviteScope(Date.now(), 1);
    const proof = await prove(alice, scope);
    const r = await app.post("/api/passes/invitations", { slot: 1, proof });
    expect(r.status).toBe(201);
    const invitation = r.body["invitation"] as string;

    // Même emplacement réutilisé : refusé (sans savoir quel membre).
    const again = await app.post("/api/passes/invitations", {
      slot: 1,
      proof: await prove(alice, scope),
    });
    expect(again.body).toMatchObject({ code: "slot_used" });
    // Emplacement hors quota.
    expect((await app.post("/api/passes/invitations", { slot: 4, proof })).status).toBe(400);
    // Preuve pour un autre emplacement que celui annoncé.
    const wrong = await app.post("/api/passes/invitations", { slot: 2, proof });
    expect(wrong.body).toMatchObject({ code: "invalid_proof" });

    // L'invité rejoint le groupe avec l'invitation, une seule fois.
    expect((await join(invitation, new Identity())).status).toBe(201);
    expect((await join(invitation, new Identity())).status).toBe(400);
  }, 30_000);

  it("une personne hors du groupe ne peut pas inviter", async () => {
    const { app, join } = await setup();
    await join(GENESIS[0]!, new Identity());
    const outsider = new Identity();
    // Preuve calculée sur un faux groupe qui contient l'intrus : racine inconnue.
    const proof = await generateProof(
      outsider,
      new Group([outsider.commitment]),
      0,
      inviteScope(Date.now(), 1),
      PROOF_DEPTH,
      ARTIFACTS,
    );
    const r = await app.post("/api/passes/invitations", { slot: 1, proof });
    expect(r.body).toMatchObject({ code: "invalid_proof" });
  }, 30_000);

  it("s'engager exige un pass, et un pass ne s'engage qu'une fois par chasse", async () => {
    const { app, prove, join } = await setup();
    const alice = new Identity();
    await join(GENESIS[0]!, alice);
    const creator = await app.login(makeWallet());
    const id = (await app.createHunt(creator, { threshold: 2 })).body["id"] as string;
    const w1 = await app.login(makeWallet());
    const w2 = await app.login(makeWallet());
    const commit = (token: string, body: Record<string, unknown>) =>
      app.post(`/api/hunts/${id}/commit`, body, token);

    expect((await commit(w1, {})).body).toMatchObject({ code: "pass_required" });

    // Seuil personnel scellé dans la preuve : impossible de le modifier.
    const sealed = await prove(alice, huntScope(id), 3);
    expect((await commit(w1, { personalThreshold: 5, proof: sealed })).body).toMatchObject({
      code: "invalid_proof",
    });
    // Preuve d'une autre chasse : refusée.
    const other = await prove(alice, huntScope("autre"), 0);
    expect((await commit(w1, { proof: other })).body).toMatchObject({ code: "invalid_proof" });

    expect((await commit(w1, { personalThreshold: 3, proof: sealed })).status).toBe(201);
    // Même personne, autre wallet : refusée.
    const twice = await commit(w2, { proof: await prove(alice, huntScope(id), 0) });
    expect(twice.status).toBe(409);
    expect(twice.body).toMatchObject({ code: "person_already_committed" });
    // Le code de pass n'apparaît jamais dans la réponse publique.
    const pub = (await app.get(`/api/hunts/${id}`)).text;
    expect(pub).not.toContain("personKey");
    expect(pub).not.toContain(sealed.nullifier);
  }, 60_000);

  it("pass non exigé : on s'engage sans preuve", async () => {
    const { app } = await setup(false);
    const id = (await app.createHunt(await app.login(makeWallet()), { threshold: 2 })).body[
      "id"
    ] as string;
    const r = await app.post(`/api/hunts/${id}/commit`, {}, await app.login(makeWallet()));
    expect(r.status).toBe(201);
  });
});
