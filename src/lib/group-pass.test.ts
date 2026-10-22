import { beforeEach, describe, expect, it } from "vitest";

import {
  createGroup,
  exportGroup,
  groups,
  importGroup,
  openPlaceRequest,
  placeLink,
  placePublic,
  sealPlaceRequest,
} from "./group-pass";
import { chatPublicKey } from "./p2p-chat";

const HUNT = "ab".repeat(12);
const DEADLINE = Date.now() + 86_400_000;

beforeEach(() => localStorage.clear());

describe("pass de groupe", () => {
  it("l'association crée des places, les liens les portent, la sauvegarde les restaure", () => {
    const g = createGroup(HUNT, "Conseil", 3);
    expect(g.places).toHaveLength(3);
    expect(createGroup(HUNT, "Conseil", 2).places).toHaveLength(5); // ajout au même groupe
    const link = placeLink("https://huntited.com/", groups()[0]!, g.places[0]!);
    expect(link).toBe(
      `https://huntited.com/#/place/${HUNT}/${g.places[0]}/${chatPublicKey(g.inbox)}`,
    );
    const backup = exportGroup(groups()[0]!);
    localStorage.clear();
    expect(importGroup(backup)?.places).toHaveLength(5);
    expect(importGroup("{}")).toBeNull();
  });

  it("la demande du membre n'est lisible que par l'association, et vérifiée", async () => {
    const g = createGroup(HUNT, "Conseil", 2);
    const inboxPub = chatPublicKey(g.inbox);
    const { event, entry } = await sealPlaceRequest(
      HUNT,
      g.places[0]!,
      inboxPub,
      { threshold: 9 },
      DEADLINE,
    );
    expect(event.content).not.toContain(entry.sig); // chiffrée
    expect(await openPlaceRequest(g, event)).toEqual(entry);
    expect(entry.place).toBe(placePublic(g.places[0]!));
    // Une autre association ne la lit pas ; une demande modifiée est refusée.
    const other = createGroup("cd".repeat(12), "Autre", 1);
    expect(await openPlaceRequest(other, event)).toBeNull();
    expect(
      await openPlaceRequest(g, { ...event, content: event.content.slice(0, -4) + "AAAA" }),
    ).toBeNull();
  });
});
