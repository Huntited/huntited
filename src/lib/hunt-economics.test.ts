import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  COMMIT_DEPOSIT_SOMPI,
  CREATE_DEPOSIT_SOMPI,
  SOMPI_PER_KAS,
  calculateSettlement,
  sompiToKasText,
} from "./hunt-economics";
import {
  COMMIT_DEPOSIT_TERMS,
  COMMIT_REFUND_HIGHLIGHT,
  COMMIT_REFUND_SHORT,
  CREATE_DEPOSIT_TERMS,
  termsFull,
  termsShort,
} from "./terms";

/** Convertit un texte KAS décimal en sompis sans flottant (pour les attentes). */
const kas = (whole: bigint, hundredths = 0n) =>
  whole * SOMPI_PER_KAS + hundredths * (SOMPI_PER_KAS / 100n);

/** Montant au format des textes français (virgule décimale). */
const fr = (sompi: bigint) => sompiToKasText(sompi).replace(".", ",");

describe("calculateSettlement", () => {
  it("succès avec 10 engagés : dépôts rendus, 1,425 KAS chacun, 0,75 KAS à la treasury, 15 KAS au créateur", () => {
    const r = calculateSettlement(10, "success");
    expect(r.participantRefundPerCommitSompi).toBe(kas(5n));
    expect(r.participantBonusPerCommitSompi).toBe(142_500_000n);
    expect(r.treasurySompi).toBe(kas(0n, 75n));
    expect(r.creatorCreationRefundSompi).toBe(kas(15n));
  });

  it("échec avec 10 engagés : dépôts rendus, 1,9 KAS chacun, 1 KAS à la treasury, 10 KAS au créateur", () => {
    const r = calculateSettlement(10, "failure");
    expect(r.participantRefundPerCommitSompi).toBe(kas(5n));
    expect(r.participantBonusPerCommitSompi).toBe(190_000_000n);
    expect(r.treasurySompi).toBe(kas(1n));
    expect(r.creatorCreationRefundSompi).toBe(kas(10n));
  });

  it("le dépôt d'engagement est toujours rendu, quelle que soit l'issue", () => {
    for (const outcome of ["success", "failure"] as const) {
      expect(calculateSettlement(7, outcome).participantRefundPerCommitSompi).toBe(
        COMMIT_DEPOSIT_SOMPI,
      );
    }
  });

  it("la part de chacun baisse quand le nombre d'engagés augmente, arrondie au sompi inférieur", () => {
    const odd = calculateSettlement(7, "failure");
    expect(odd.participantBonusPerCommitSompi).toBe(kas(19n) / 7n);
    // Le reste de l'arrondi revient au créateur.
    expect(odd.creatorCreationRefundSompi).toBe(kas(10n) + (kas(19n) % 7n));
  });

  it("sans engagé, la part sans destinataire revient au créateur", () => {
    const r = calculateSettlement(0, "failure");
    expect(r.participantBonusPerCommitSompi).toBe(0n);
    expect(r.treasurySompi).toBe(kas(1n));
    expect(r.creatorCreationRefundSompi).toBe(kas(29n));
  });

  it("succès : un·e non-retenu·e récupère 5 KAS, sans part de la récompense ; rien en échec", () => {
    expect(calculateSettlement(10, "success").nonRetainedRefundPerCommitSompi).toBe(kas(5n));
    expect(calculateSettlement(10, "failure").nonRetainedRefundPerCommitSompi).toBe(0n);
  });

  it("succès avec non-retenu·es : sorties = dépôts, au sompi près", () => {
    for (const [retained, nonRetained] of [
      [7, 1],
      [10, 15],
      [1, 0],
      [99, 1_000],
    ] as const) {
      const s = calculateSettlement(retained, "success");
      const deposits = CREATE_DEPOSIT_SOMPI + BigInt(retained + nonRetained) * COMMIT_DEPOSIT_SOMPI;
      const payout =
        s.creatorCreationRefundSompi +
        s.treasurySompi +
        BigInt(retained) * (s.participantRefundPerCommitSompi + s.participantBonusPerCommitSompi) +
        BigInt(nonRetained) * s.nonRetainedRefundPerCommitSompi;
      expect(payout).toBe(deposits);
    }
  });

  it("tous les montants sont des bigint", () => {
    for (const outcome of ["success", "failure"] as const) {
      for (const value of Object.values(calculateSettlement(7, outcome))) {
        expect(typeof value).toBe("bigint");
      }
    }
  });

  it("le calcul n'utilise aucun flottant ni Math.*", () => {
    const source = readFileSync("src/lib/hunt-economics.ts", "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    expect(code).not.toMatch(/\b\d+\.\d+\b/);
    expect(code).not.toMatch(/Math\./);
    expect(code).not.toMatch(/parseFloat|toFixed/);
  });

  it("refuse un nombre d'engagements négatif, non entier ou non fini", () => {
    for (const outcome of ["success", "failure"] as const) {
      for (const bad of [
        -1,
        1.5,
        Number.NaN,
        Number.POSITIVE_INFINITY,
        Number.MAX_SAFE_INTEGER + 1,
      ]) {
        expect(() => calculateSettlement(bad, outcome)).toThrow("Nombre d'engagements invalide.");
      }
    }
  });

  it("conserve exactement les fonds, quel que soit le nombre d'engagements", () => {
    for (const n of [0, 1, 3, 7, 10, 29, 30, 31, 60, 999, 1_000_003]) {
      const deposits = CREATE_DEPOSIT_SOMPI + BigInt(n) * COMMIT_DEPOSIT_SOMPI;
      for (const outcome of ["success", "failure"] as const) {
        const s = calculateSettlement(n, outcome);
        const payout =
          s.creatorCreationRefundSompi +
          s.treasurySompi +
          BigInt(n) * (s.participantRefundPerCommitSompi + s.participantBonusPerCommitSompi);
        expect(payout).toBe(deposits);
        expect(s.creatorCreationRefundSompi >= 0n).toBe(true);
      }
    }
  });
});

describe("sompiToKasText", () => {
  it("formate sans flottant", () => {
    expect(sompiToKasText(kas(30n))).toBe("30");
    expect(sompiToKasText(kas(47n, 50n))).toBe("47.5");
    expect(sompiToKasText(1n)).toBe("0.00000001");
    expect(sompiToKasText(0n)).toBe("0");
  });
});

describe("textes UX des dépôts", () => {
  // Récompense totale des engagés, recalculée depuis l'économie (1 engagé reçoit tout).
  const success = calculateSettlement(1, "success");
  const failure = calculateSettlement(1, "failure");

  it("ne promettent pas une confidentialité cryptographique qui n'existe pas encore", () => {
    for (const line of termsShort) expect(line).not.toMatch(/\bZK\b/);
    expect(termsFull).not.toMatch(/ne peut savoir/);
    expect(termsFull).toMatch(/pas encore une garantie cryptographique/);
  });

  it("annoncent les montants calculés par l'économie", () => {
    expect(success.participantBonusPerCommitSompi).toBe(kas(14n, 25n));
    expect(failure.participantBonusPerCommitSompi).toBe(kas(19n));
    for (const text of [COMMIT_DEPOSIT_TERMS, CREATE_DEPOSIT_TERMS, termsFull]) {
      expect(text).toContain(`${fr(success.participantBonusPerCommitSompi)} KAS`);
      expect(text).toContain(`${fr(failure.participantBonusPerCommitSompi)} KAS`);
    }
    for (const text of [CREATE_DEPOSIT_TERMS, termsFull]) {
      expect(text).toContain(`${fr(success.treasurySompi)} KAS`);
      expect(text).toContain(`${fr(failure.treasurySompi)} KAS`);
      expect(text).toContain(`${fr(success.creatorCreationRefundSompi)} KAS`);
      expect(text).toContain(`${fr(failure.creatorCreationRefundSompi)} KAS`);
    }
    expect(COMMIT_DEPOSIT_TERMS).toContain(`${sompiToKasText(COMMIT_DEPOSIT_SOMPI)} KAS`);
    expect(CREATE_DEPOSIT_TERMS).toContain(`${sompiToKasText(CREATE_DEPOSIT_SOMPI)} KAS`);
  });

  it("la mise en avant du remboursement correspond à l'économie et ne promet pas la gratuité", () => {
    expect(COMMIT_REFUND_HIGHLIGHT).toContain(
      `${sompiToKasText(success.participantRefundPerCommitSompi)} KAS`,
    );
    expect(COMMIT_REFUND_HIGHLIGHT).toContain(`${fr(success.participantBonusPerCommitSompi)} KAS`);
    expect(COMMIT_REFUND_HIGHLIGHT).toContain(`${fr(failure.participantBonusPerCommitSompi)} KAS`);
    for (const text of [COMMIT_REFUND_HIGHLIGHT, COMMIT_REFUND_SHORT]) {
      expect(text).toMatch(/intégralement/);
      expect(text).toMatch(/récompense/);
      expect(text).not.toMatch(/gratuit/i);
    }
  });
});
