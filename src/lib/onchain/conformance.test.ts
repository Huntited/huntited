// Conformité : le grand livre du navigateur et celui du serveur doivent
// obtenir exactement le même état à partir des mêmes transactions. Sinon,
// deux personnes verraient des chasses différentes.
import { describe, expect, it } from "vitest";

import { Ledger as ServerLedger } from "../../../backend/src/chain/ledger";
import { Ledger as BrowserLedger, type ChainEvent } from "./ledger";
import { encodeMessage, type Genesis, type Message } from "./protocol";

const GENESIS: Genesis = {
  invitationKeys: [],
  minThreshold: 2,
  minCautionKas: 30,
  invitesPerMonth: 3,
  passRequired: false,
};

/** Générateur pseudo-aléatoire reproductible. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function scenario(seed: number): ChainEvent[] {
  const r = rng(seed);
  const pick = <T>(xs: T[]) => xs[Math.floor(r() * xs.length)]!;
  const T0 = Date.UTC(2026, 9, 7);
  const ids = Array.from({ length: 5 }, (_, i) => `${i}`.padStart(24, "a"));
  const senders = Array.from({ length: 12 }, (_, i) => `kaspatest:p${i}`);
  const events: ChainEvent[] = [];
  for (let i = 0; i < 300; i++) {
    const time = T0 + Math.floor(r() * 10 * 86_400_000);
    const kind = r();
    let payload: Uint8Array;
    if (kind < 0.15) {
      const m: Message = {
        t: "hunt",
        id: pick(ids),
        title: `Chasse ${i}`,
        description: "Ensemble",
        location: pick(["Marseille", "@online"]),
        deadline: time + Math.floor(r() * 6 * 86_400_000) - 86_400_000,
        threshold: 1 + Math.floor(r() * 5),
        deposit: pick([10, 30, 50]),
        progressVisibility: pick(["visible", "hidden"] as const),
      };
      payload = encodeMessage(m);
    } else if (kind < 0.9) {
      const m: Message = {
        t: "commit",
        hunt: pick(ids),
        ...(r() < 0.5 ? { threshold: 1 + Math.floor(r() * 6) } : {}),
      };
      payload = encodeMessage(m);
    } else if (kind < 0.95) {
      payload = new TextEncoder().encode(pick(["hello", 'HNT1{"t":"x"}', "HNT1{broken"]));
    } else {
      // Pass sans invitation valide : refusé des deux côtés.
      payload = encodeMessage({
        t: "pass",
        key: "a".repeat(64),
        commitment: "123",
        sig: "b".repeat(128),
      });
    }
    events.push({ txId: `tx${i % 290}`, time, sender: pick(senders), payload });
  }
  return events.sort((a, b) => a.time - b.time);
}

describe("conformité navigateur / serveur", () => {
  it.each([1, 2, 3, 42, 2026])("mêmes transactions → même état (graine %i)", async (seed) => {
    const events = scenario(seed);
    const server = new ServerLedger(GENESIS);
    const browser = new BrowserLedger(GENESIS);
    const reasons: [string, string][] = [];
    for (const e of events) {
      const a = await server.apply(e);
      const b = await browser.apply(e);
      reasons.push([JSON.stringify(a), JSON.stringify(b)]);
    }
    for (const [a, b] of reasons) expect(b).toBe(a);
    expect(browser.allHunts()).toEqual(server.allHunts());
    const now = Date.UTC(2026, 9, 12);
    for (const h of server.allHunts()) {
      expect(browser.status(browser.hunt(h.id)!, now)).toEqual(server.status(h, now));
      expect(browser.retainedGroup(browser.hunt(h.id)!)).toEqual(server.retainedGroup(h));
    }
    // Le scénario exerce bien les règles (pas seulement des refus).
    expect(server.allHunts().some((h) => h.activatedAt !== undefined)).toBe(true);
  });
});
