// Seuil personnel en mode local (démo) : mêmes règles que le registre.
import { beforeEach, describe, expect, it } from "vitest";

import { getWalletBadges } from "./badge-activity";
import { createHuntCovenant } from "./covenants";
import { commit, getHuntView, isRetainedHere } from "./hunt-repository";

let n = 0;
const wallet = () => `kaspatest:qq_wallet_${(n += 1)}`;

async function createHunt(threshold: number) {
  const { huntId } = await createHuntCovenant({
    title: "Chasse",
    description: "D",
    location: "L",
    deadline: new Date(Date.now() + 86_400_000).toISOString(),
    threshold,
    deposit: 30,
    commitDeposit: 5,
  });
  return huntId;
}

beforeEach(() => window.localStorage.clear());

describe("seuil personnel (mode local)", () => {
  it("exemple du document : activation à 5 engagés, groupe de 4, l'exigeant·e (10) hors groupe", async () => {
    const id = await createHunt(3);
    const bruno = wallet();
    await commit(id, wallet(), 3);
    await commit(id, wallet());
    await commit(id, wallet(), 4);
    await commit(id, bruno, 10);
    expect(await getHuntView(id)).toMatchObject({
      status: "active",
      commitCount: 4,
      retainedCount: 0,
      commitsOpen: true,
    });

    const fifth = wallet();
    await commit(id, fifth);
    const v = await getHuntView(id);
    expect(v).toMatchObject({
      status: "activated",
      commitCount: 5,
      retainedCount: 4,
      retainedThreshold: 4,
      activationRank: 5,
      commitsOpen: true,
    });
    expect(isRetainedHere(id, bruno)).toBe(false);
    expect(isRetainedHere(id, fifth)).toBe(true);
  });

  it("le groupe grandit après l'activation (engagements ouverts jusqu'à la date limite)", async () => {
    const id = await createHunt(2);
    const exigeant = wallet();
    await commit(id, exigeant, 4);
    await commit(id, wallet());
    await commit(id, wallet());
    expect((await getHuntView(id))?.retainedCount).toBe(2);
    expect(isRetainedHere(id, exigeant)).toBe(false);

    await commit(id, wallet());
    expect((await getHuntView(id))?.retainedCount).toBe(4);
    expect(isRetainedHere(id, exigeant)).toBe(true);
  });

  it("refuse un seuil personnel inférieur au seuil de la chasse", async () => {
    const id = await createHunt(3);
    await expect(commit(id, wallet(), 2)).rejects.toThrow("au moins 3");
  });

  it("badges : un·e non-retenu·e n'obtient pas de badge de réussite ; le déclencheur est l'engagement qui active", async () => {
    const id = await createHunt(2);
    const exigeant = wallet();
    const premier = wallet();
    const declencheur = wallet();
    await commit(id, exigeant, 10);
    await commit(id, premier);
    await commit(id, declencheur);
    await getHuntView(id); // persiste l'activation (rang d'activation = 3)

    // Rang 1 mais non retenu·e : aucun badge (la chasse a réussi sans elle/lui).
    expect(getWalletBadges(exigeant)).toEqual([]);
    // Rang 2 : hors des 10 % premiers (1 place pour un seuil de 2).
    expect(getWalletBadges(premier).map((b) => b.id)).toEqual(["habitue"]);
    // Rang 3 : l'engagement qui a formé le groupe retenu.
    expect(getWalletBadges(declencheur).map((b) => b.id)).toEqual(["declencheur", "habitue"]);
  });
});
