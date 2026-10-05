// Tests de persistance du prototype mocké (statuts, rooms Matrix, règlement).
import { beforeEach, describe, expect, it } from "vitest";

import { calculateSettlement, COMMIT_DEPOSIT_SOMPI, CREATE_DEPOSIT_SOMPI } from "./hunt-economics";
import { deriveAndPersistHuntState, getStoredHuntState, markHuntSettled } from "./hunt-state-store";
import { mockCreateChat, mockGetChatStatus } from "./matrix-mock";

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

describe("matrix-mock", () => {
  it("room supprimée à expiration", async () => {
    await mockCreateChat(hunt.id, Date.now() + 1000, "activated", undefined, { delayMs: 0 });
    expect((await mockGetChatStatus(hunt.id, { delayMs: 0 })).isActive).toBe(true);
    const res = await mockGetChatStatus(hunt.id, { delayMs: 0, now: Date.now() + 5000 });
    expect(res.isActive).toBe(false);
    expect(window.localStorage.getItem("huntited:mock-chat-rooms")).toBe("{}");
  });

  it("refuse la création si la hunt est active ou expirée", async () => {
    await expect(
      mockCreateChat(hunt.id, Date.now() + 1000, "active", undefined, { delayMs: 0 }),
    ).rejects.toThrow();
    await expect(
      mockCreateChat(hunt.id, Date.now() + 1000, "expired", undefined, { delayMs: 0 }),
    ).rejects.toThrow();
    await expect(
      mockCreateChat(hunt.id, Date.now() + 1000, "settled", "failure", { delayMs: 0 }),
    ).rejects.toThrow();
  });
});

describe("règlement", () => {
  it("échec : treasury 0 et 5 KAS remboursés par engagé", () => {
    const s = calculateSettlement(2, "failure");
    expect(s.treasurySompi).toBe(0n);
    expect(s.participantRefundPerCommitSompi).toBe(COMMIT_DEPOSIT_SOMPI);
    expect(s.creatorCreationRefundSompi).toBe(CREATE_DEPOSIT_SOMPI);
  });

  it("succès : treasury 5 %, créateur 30 KAS + 95 %", () => {
    const s = calculateSettlement(10, "success");
    const commits = COMMIT_DEPOSIT_SOMPI * 10n;
    expect(s.treasurySompi).toBe((commits * 5n) / 100n);
    expect(s.creatorCommitRewardSompi).toBe(commits - (commits * 5n) / 100n);
    expect(s.creatorCreationRefundSompi).toBe(CREATE_DEPOSIT_SOMPI);
    expect(s.participantRefundPerCommitSompi).toBe(0n);
  });
});
