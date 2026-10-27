import { beforeEach, describe, expect, it } from "vitest";

import { addUserHunt, creatorFingerprint, getUserHunts } from "./user-hunts";

const ADDRESS = "kaspatest:qq_creator_address_aaaa";
const ref = (huntId: string) => ({
  huntId,
  title: "Action",
  location: "Lieu",
  deadline: "2026-12-01T00:00:00.000Z",
  threshold: 2,
});

beforeEach(() => window.localStorage.clear());

describe("registre des créateurs", () => {
  it("n'enregistre jamais l'adresse brute du créateur", () => {
    addUserHunt(ADDRESS, ref("h1"));
    const raw = window.localStorage.getItem("huntited:user-hunts") ?? "";
    expect(raw).not.toContain(ADDRESS);
    expect(raw).toContain(creatorFingerprint(ADDRESS));
    expect(getUserHunts(ADDRESS).map((h) => h.huntId)).toEqual(["h1"]);
  });

  it("migre l'ancien format indexé par adresse brute", () => {
    window.localStorage.setItem("huntited:user-hunts", JSON.stringify({ [ADDRESS]: [ref("old")] }));
    expect(getUserHunts(ADDRESS).map((h) => h.huntId)).toEqual(["old"]);
    expect(window.localStorage.getItem("huntited:user-hunts")).not.toContain(ADDRESS);

    addUserHunt(ADDRESS, ref("new"));
    expect(getUserHunts(ADDRESS).map((h) => h.huntId)).toEqual(["old", "new"]);
  });

  it("ignore les doublons", () => {
    addUserHunt(ADDRESS, ref("h1"));
    addUserHunt(ADDRESS, ref("h1"));
    expect(getUserHunts(ADDRESS)).toHaveLength(1);
  });
});
