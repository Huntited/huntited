// Tests de persistance du prototype mocké (statuts, règlement).
import { beforeEach, describe, expect, it } from "vitest";

import { calculateSettlement, COMMIT_DEPOSIT_SOMPI, CREATE_DEPOSIT_SOMPI } from "./hunt-economics";
import { deriveAndPersistHuntState, getStoredHuntState, markHuntSettled } from "./hunt-state-store";

const hunt = { id: "hunt_test", threshold: 3, deadline: "2026-10-10T18:00:00Z" };
const before = new Date("2026-10-09T12:00:00Z").getTime();
const after = new Date("2026-10-11T12:00:00Z").getTime();

beforeEach(() => window.localStorage.clear());

describe("hunt-state-store", () => {
  it("l'activation reste persistée après la deadline", () => {
    deriveAndPersistHuntState(hunt, 3, before);
    expect(deriveAndPersistHuntState(hunt, 3, after).status).toBe("activated");
    expect(getStoredHuntState(hunt.id)?.status).toBe("activated");
  });

  it("expiration persistée si le seuil n'est pas atteint", () => {
    deriveAndPersistHuntState(hunt, 1, after);
    expect(getStoredHuntState(hunt.id)?.status).toBe("expired");
  });

  it("settled n'est jamais écrasé", () => {
    deriveAndPersistHuntState(hunt, 1, after);
    markHuntSettled(hunt.id, "failure");
    deriveAndPersistHuntState(hunt, 3, after);
    markHuntSettled(hunt.id, "success");
    const s = getStoredHuntState(hunt.id);
    expect(s?.status).toBe("settled");
    expect(s?.settlementOutcome).toBe("failure");
  });
});

describe("règlement", () => {
  it("échec : dépôts rendus, aucune récompense, 1 KAS à la treasury, 29 KAS au créateur", () => {
    const s = calculateSettlement(2, "failure");
    const kas = CREATE_DEPOSIT_SOMPI / 30n;
    expect(s.treasurySompi).toBe(kas);
    expect(s.participantRefundPerCommitSompi).toBe(COMMIT_DEPOSIT_SOMPI);
    expect(s.participantBonusPerCommitSompi).toBe(0n);
    expect(s.creatorCreationRefundSompi).toBe(29n * kas);
  });

  it("succès : dépôts rendus, 1 KAS par engagé (plafond), 0,75 KAS à la treasury", () => {
    const s = calculateSettlement(10, "success");
    const kas = CREATE_DEPOSIT_SOMPI / 30n;
    expect(s.treasurySompi).toBe((75n * kas) / 100n);
    expect(s.participantBonusPerCommitSompi).toBe(kas);
    expect(s.creatorCreationRefundSompi).toBe(30n * kas - (75n * kas) / 100n - 10n * kas);
    expect(s.participantRefundPerCommitSompi).toBe(COMMIT_DEPOSIT_SOMPI);
  });
});
