import { beforeEach, describe, expect, it } from "vitest";

import { openPlaceRequest, placePublic, sealPlaceRequest } from "./group-pass";
import { verifyPlaceCommit } from "./onchain/protocol";
import {
  addMembers,
  createOrg,
  exportOrg,
  importOrg,
  memberLink,
  memberPlaceKey,
  openHunt,
  orgGroup,
  orgs,
} from "./org-pass";
import { chatPublicKey } from "./p2p-chat";

const A = "ab".repeat(12);
const B = "cd".repeat(12);

beforeEach(() => localStorage.clear());

describe("pass d'organisation", () => {
  it("un lien permanent par adhérent ; des adhérents peuvent s'ajouter", () => {
    const org = createOrg("Syndicat des cheminots", 3);
    expect(org.members.map((m) => m.label)).toEqual(["#1", "#2", "#3"]);
    expect(addMembers(org, 2).members).toHaveLength(5);
    const link = memberLink("https://huntited.com/", org, org.members[0]!);
    expect(link).toBe(
      `https://huntited.com/#/member/${chatPublicKey(org.inbox)}/${org.members[0]!.secret}`,
    );
    const backup = exportOrg(orgs()[0]!);
    localStorage.clear();
    expect(importOrg(backup)?.members).toHaveLength(5);
  });

  it("une place différente par action : impossible de relier les engagements d'un adhérent", () => {
    const { secret } = createOrg("Asso", 1).members[0]!;
    expect(memberPlaceKey(secret, A)).toBe(memberPlaceKey(secret, A)); // stable
    expect(memberPlaceKey(secret, A)).not.toBe(memberPlaceKey(secret, B));
    expect(placePublic(memberPlaceKey(secret, A))).not.toBe(placePublic(memberPlaceKey(secret, B)));
  });

  it("l'organisation ouvre une action et lit la demande signée de l'adhérent", async () => {
    let org = createOrg("Collectif", 2);
    org = openHunt(org, A, "Grève du 12");
    expect(org.hunts).toEqual([{ hunt: A, title: "Grève du 12" }]);
    const g = orgGroup(org, A, "Grève du 12");
    const placeKey = memberPlaceKey(org.members[1]!.secret, A);
    expect(g.places).toContain(placeKey);
    const { event, entry } = await sealPlaceRequest(
      A,
      placeKey,
      chatPublicKey(org.inbox),
      {},
      Date.now() + 86_400_000,
    );
    expect(await openPlaceRequest(g, event)).toEqual(entry);
    expect(verifyPlaceCommit(A, entry)).toBe(true);
  });
});
