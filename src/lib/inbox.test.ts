import { beforeEach, describe, expect, it } from "vitest";

import { addInboxItem, inboxItems, markRead, noteHuntState, unreadCount } from "./inbox";

const A = "ab".repeat(12);
const B = "cd".repeat(12);

beforeEach(() => localStorage.clear());

describe("activité de tes actions (cloche)", () => {
  it("les messages non lus d'une action ne font qu'une ligne", () => {
    addInboxItem({ huntId: A, kind: "message", title: "Conseil", at: 1 });
    addInboxItem({ huntId: A, kind: "message", title: "Conseil", at: 2 });
    addInboxItem({ huntId: B, kind: "activated", title: "Marche", at: 3 });
    expect(inboxItems().map((i) => [i.kind, i.at])).toEqual([
      ["activated", 3],
      ["message", 2],
    ]);
    expect(unreadCount()).toBe(2);
  });

  it("ouvrir une action marque ses nouveautés comme lues", () => {
    addInboxItem({ huntId: A, kind: "message", title: "Conseil", at: 1 });
    addInboxItem({ huntId: B, kind: "failed", title: "Marche", at: 2 });
    markRead({ huntId: A });
    expect(unreadCount()).toBe(1);
    markRead();
    expect(unreadCount()).toBe(0);
  });

  it("signale un changement d'état une seule fois", () => {
    expect(noteHuntState(A, "active")).toBeNull();
    expect(noteHuntState(A, "activated")).toBe("activated");
    expect(noteHuntState(A, "activated")).toBeNull();
    // Chasse jamais vue mais déjà terminée : elle était en cours quand tu l'as rejointe.
    expect(noteHuntState(B, "failed")).toBe("failed");
  });
});
