import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  COMMIT_DEPOSIT_SOMPI,
  CREATE_DEPOSIT_SOMPI,
  MIN_THRESHOLD,
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
  it("succès avec 10 engagés : 47,5 KAS au créateur, 2,85 KAS de caution à chaque engagé", () => {
    const r = calculateSettlement(10, "success");
    expect(r.creatorCommitRewardSompi).toBe(kas(47n, 50n));
    expect(r.participantBonusPerCommitSompi).toBe(kas(2n, 85n));
    // Caution : 28,5 KAS aux engagés, 1,5 KAS à la treasury, rien au créateur.
    expect(r.creatorCreationRefundSompi).toBe(0n);
    // Treasury : 5 % des engagements (2,5) + 5 % de la caution (1,5).
    expect(r.treasurySompi).toBe(kas(4n));
    expect(r.participantRefundPerCommitSompi).toBe(0n);
  });

  it("échec avec 10 engagés : 5 + 1,425 KAS à chaque engagé, 15 KAS au créateur, 0,75 KAS à la treasury", () => {
    const r = calculateSettlement(10, "failure");
    expect(r.participantRefundPerCommitSompi).toBe(kas(5n));
    expect(r.participantBonusPerCommitSompi).toBe(142_500_000n);
    expect(r.creatorCreationRefundSompi).toBe(kas(15n));
    expect(r.creatorCommitRewardSompi).toBe(0n);
    expect(r.treasurySompi).toBe(kas(0n, 75n));
  });

  it("au seuil minimum, le créateur ne perd pas d'argent en cas de succès", () => {
    const r = calculateSettlement(MIN_THRESHOLD, "success");
    expect(r.creatorCommitRewardSompi + r.creatorCreationRefundSompi >= CREATE_DEPOSIT_SOMPI).toBe(
      true,
    );
    // Juste en dessous, il perdrait : c'est ce qui fixe le minimum.
    const below = calculateSettlement(MIN_THRESHOLD - 1, "success");
    expect(below.creatorCommitRewardSompi + below.creatorCreationRefundSompi).toBeLessThan(
      CREATE_DEPOSIT_SOMPI,
    );
  });

  it("la part de chacun baisse quand le nombre d'engagés augmente, arrondie au sompi inférieur", () => {
    const r = calculateSettlement(3, "failure");
    // 14,25 KAS / 3 = 4,75 KAS exactement.
    expect(r.participantBonusPerCommitSompi).toBe(kas(4n, 75n));
    const odd = calculateSettlement(7, "failure");
    expect(odd.participantBonusPerCommitSompi).toBe(1_425_000_000n / 7n);
    // Le reste de l'arrondi revient au créateur.
    expect(odd.creatorCreationRefundSompi).toBe(kas(15n) + (1_425_000_000n % 7n));
  });

  it("échec sans engagement : la part sans destinataire revient au créateur", () => {
    const r = calculateSettlement(0, "failure");
    expect(r.participantBonusPerCommitSompi).toBe(0n);
    expect(r.treasurySompi).toBe(kas(0n, 75n));
    expect(r.creatorCreationRefundSompi).toBe(CREATE_DEPOSIT_SOMPI - kas(0n, 75n));
  });

  it("succès : un·e non-retenu·e récupère 5 KAS, sans part de la caution ; rien en échec", () => {
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
        s.creatorCommitRewardSompi +
        s.treasurySompi +
        BigInt(retained) * s.participantBonusPerCommitSompi +
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
      const total = BigInt(n) * COMMIT_DEPOSIT_SOMPI;
      const deposits = CREATE_DEPOSIT_SOMPI + total;
      for (const outcome of ["success", "failure"] as const) {
        const s = calculateSettlement(n, outcome);
        const payout =
          s.creatorCreationRefundSompi +
          s.creatorCommitRewardSompi +
          s.treasurySompi +
          BigInt(n) * (s.participantRefundPerCommitSompi + s.participantBonusPerCommitSompi);
        expect(payout).toBe(deposits);
        expect(s.creatorCreationRefundSompi >= 0n).toBe(true);
      }
      const ok = calculateSettlement(n, "success");
      expect(ok.creatorCommitRewardSompi * 20n).toBe(total * 19n);
      expect(ok.participantRefundPerCommitSompi).toBe(0n);
      expect(calculateSettlement(n, "failure").participantRefundPerCommitSompi).toBe(
        COMMIT_DEPOSIT_SOMPI,
      );
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
  // Parts totales de la caution, recalculées depuis l'économie (1 engagé reçoit tout).
  const successPool = calculateSettlement(1, "success").participantBonusPerCommitSompi;
  const failurePool = calculateSettlement(1, "failure").participantBonusPerCommitSompi;

  it("ne promettent pas une confidentialité cryptographique qui n'existe pas encore", () => {
    for (const line of termsShort) expect(line).not.toMatch(/\bZK\b/);
    expect(termsFull).not.toMatch(/ne peut savoir/);
    expect(termsFull).toMatch(/pas encore une garantie cryptographique/);
  });

  it("annoncent les montants calculés par l'économie", () => {
    expect(successPool).toBe(kas(28n, 50n));
    expect(failurePool).toBe(kas(14n, 25n));
    for (const text of [COMMIT_DEPOSIT_TERMS, CREATE_DEPOSIT_TERMS, termsFull]) {
      expect(text).toContain(`${fr(successPool)} KAS`);
      expect(text).toContain(`${fr(failurePool)} KAS`);
    }
    expect(COMMIT_DEPOSIT_TERMS).toContain(`${sompiToKasText(COMMIT_DEPOSIT_SOMPI)} KAS`);
    expect(CREATE_DEPOSIT_TERMS).toContain(`${sompiToKasText(CREATE_DEPOSIT_SOMPI)} KAS`);
    // En échec, le créateur récupère la moitié de sa caution.
    const creatorHalf = calculateSettlement(1, "failure").creatorCreationRefundSompi;
    expect(creatorHalf).toBe(CREATE_DEPOSIT_SOMPI / 2n);
    expect(termsFull).toContain(`${fr(creatorHalf)} KAS`);
  });

  it("la mise en avant du remboursement correspond à l'économie et ne promet pas la gratuité", () => {
    // En échec, chaque engagé récupère exactement son dépôt.
    const refund = calculateSettlement(10, "failure").participantRefundPerCommitSompi;
    expect(refund).toBe(COMMIT_DEPOSIT_SOMPI);
    expect(COMMIT_REFUND_HIGHLIGHT).toContain(`${sompiToKasText(refund)} KAS`);
    expect(COMMIT_REFUND_HIGHLIGHT).toContain(`${fr(failurePool)} KAS`);
    expect(COMMIT_REFUND_HIGHLIGHT).toContain(`${fr(successPool)} KAS`);
    for (const text of [COMMIT_REFUND_HIGHLIGHT, COMMIT_REFUND_SHORT]) {
      expect(text).toMatch(/intégralement/);
      expect(text).toMatch(/caution/);
      expect(text).not.toMatch(/gratuit/i);
    }
  });
});
