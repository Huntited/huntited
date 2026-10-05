import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  COMMIT_DEPOSIT_SOMPI,
  CREATE_DEPOSIT_SOMPI,
  FAILURE_BONUS_PER_COMMIT_SOMPI,
  SOMPI_PER_KAS,
  calculateSettlement,
  sompiToKasText,
} from "./hunt-economics";
import {
  COMMIT_DEPOSIT_TERMS,
  COMMIT_REFUND_HIGHLIGHT,
  COMMIT_REFUND_SHORT,
  CREATE_DEPOSIT_TERMS,
} from "./terms";

/** Convertit un texte KAS décimal en sompis sans flottant (pour les attentes). */
const kas = (whole: bigint, tenths = 0n) => whole * SOMPI_PER_KAS + tenths * (SOMPI_PER_KAS / 10n);

describe("calculateSettlement", () => {
  it("succès avec 10 engagements : 30 + 47,5 KAS au créateur, 2,5 KAS au treasury, 0 aux engagés", () => {
    const r = calculateSettlement(10, "success");
    expect(r.creatorCreationRefundSompi).toBe(kas(30n));
    expect(r.creatorCommitRewardSompi).toBe(kas(47n, 5n));
    expect(r.treasurySompi).toBe(kas(2n, 5n));
    expect(r.participantRefundPerCommitSompi).toBe(0n);
    // Le dépôt de création n'entre pas dans la répartition 95/5.
    expect(r.creatorCommitRewardSompi + r.treasurySompi).toBe(10n * COMMIT_DEPOSIT_SOMPI);
  });

  it("échec avec 10 engagements : 5 + 1 KAS à chaque engagé, 20 KAS au créateur, 0 au treasury", () => {
    const r = calculateSettlement(10, "failure");
    expect(r.participantRefundPerCommitSompi).toBe(kas(5n));
    expect(r.participantBonusPerCommitSompi).toBe(kas(1n));
    expect(r.creatorCreationRefundSompi).toBe(kas(20n));
    expect(r.creatorCommitRewardSompi).toBe(0n);
    expect(r.treasurySompi).toBe(0n);
  });

  it("bonus d'échec plafonné au dépôt de création, partagé au-delà de 30 engagés", () => {
    const at30 = calculateSettlement(30, "failure");
    expect(at30.participantBonusPerCommitSompi).toBe(kas(1n));
    expect(at30.creatorCreationRefundSompi).toBe(0n);

    const at60 = calculateSettlement(60, "failure");
    expect(at60.participantBonusPerCommitSompi).toBe(kas(0n, 5n));
    expect(at60.creatorCreationRefundSompi).toBe(0n);

    const at7 = calculateSettlement(7, "failure");
    expect(at7.participantBonusPerCommitSompi).toBe(kas(1n));
    expect(at7.creatorCreationRefundSompi).toBe(kas(23n));
  });

  it("échec sans engagement : le créateur récupère ses 30 KAS", () => {
    const r = calculateSettlement(0, "failure");
    expect(r.creatorCreationRefundSompi).toBe(CREATE_DEPOSIT_SOMPI);
    expect(r.participantBonusPerCommitSompi).toBe(0n);
  });

  it("aucun bonus en cas de succès", () => {
    expect(calculateSettlement(10, "success").participantBonusPerCommitSompi).toBe(0n);
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

  it("succès sans engagement : seul le dépôt de création est rendu", () => {
    const r = calculateSettlement(0, "success");
    expect(r.creatorCreationRefundSompi).toBe(CREATE_DEPOSIT_SOMPI);
    expect(r.creatorCommitRewardSompi).toBe(0n);
    expect(r.treasurySompi).toBe(0n);
  });

  it("conserve exactement les fonds, quel que soit le nombre d'engagements", () => {
    for (const n of [0, 1, 3, 7, 10, 29, 30, 31, 60, 999, 1_000_003]) {
      const total = BigInt(n) * COMMIT_DEPOSIT_SOMPI;
      const deposits = CREATE_DEPOSIT_SOMPI + total;
      const ok = calculateSettlement(n, "success");
      expect(ok.creatorCommitRewardSompi + ok.treasurySompi).toBe(total);
      expect(ok.treasurySompi * 20n).toBe(total);
      expect(ok.participantRefundPerCommitSompi).toBe(0n);
      const ko = calculateSettlement(n, "failure");
      expect(ko.participantRefundPerCommitSompi * BigInt(n)).toBe(total);
      expect(ko.creatorCommitRewardSompi + ko.treasurySompi).toBe(0n);
      // Sorties = dépôts, au sompi près ; le bonus ne dépasse jamais le dépôt de création.
      const payout =
        ko.creatorCreationRefundSompi +
        BigInt(n) * (ko.participantRefundPerCommitSompi + ko.participantBonusPerCommitSompi);
      expect(payout).toBe(deposits);
      expect(ko.creatorCreationRefundSompi >= 0n).toBe(true);
      expect(ko.participantBonusPerCommitSompi <= kas(1n)).toBe(true);
    }
  });
});

describe("sompiToKasText", () => {
  it("formate sans flottant", () => {
    expect(sompiToKasText(kas(30n))).toBe("30");
    expect(sompiToKasText(kas(47n, 5n))).toBe("47.5");
    expect(sompiToKasText(1n)).toBe("0.00000001");
    expect(sompiToKasText(0n)).toBe("0");
  });
});

describe("textes UX des dépôts", () => {
  it("reprennent la formulation de référence du MVP", () => {
    expect(COMMIT_DEPOSIT_TERMS).toBe(
      "Un engagement coûte 5 KAS. Si le seuil n'est pas atteint avant la deadline, le dépôt est remboursé intégralement, avec un bonus pouvant aller jusqu'à 1 KAS pris sur le dépôt du créateur. Si le seuil est atteint, le dépôt finance le créateur à 95 % et la treasury à 5 %.",
    );
    expect(CREATE_DEPOSIT_TERMS).toBe(
      "Le dépôt de création de 30 KAS est remboursé au créateur si le seuil est atteint. Sinon, il verse d'abord 1 KAS de bonus à chaque engagé (30 KAS au plus, partagés au-delà de 30 engagés) et le créateur récupère le reste.",
    );
  });

  it("annoncent les montants calculés par l'économie", () => {
    expect(COMMIT_DEPOSIT_TERMS).toContain(`${sompiToKasText(COMMIT_DEPOSIT_SOMPI)} KAS`);
    expect(CREATE_DEPOSIT_TERMS).toContain(`${sompiToKasText(CREATE_DEPOSIT_SOMPI)} KAS`);
  });

  it("la mise en avant du remboursement correspond à l'économie et ne promet pas la gratuité", () => {
    // En échec, chaque engagé récupère exactement son dépôt.
    const refund = calculateSettlement(10, "failure").participantRefundPerCommitSompi;
    expect(refund).toBe(COMMIT_DEPOSIT_SOMPI);
    expect(COMMIT_REFUND_HIGHLIGHT).toContain(`${sompiToKasText(refund)} KAS`);
    const bonus = sompiToKasText(FAILURE_BONUS_PER_COMMIT_SOMPI);
    for (const text of [COMMIT_DEPOSIT_TERMS, COMMIT_REFUND_HIGHLIGHT, COMMIT_REFUND_SHORT]) {
      // Le plafond rend le bonus variable : toujours « jusqu'à », jamais promis tel quel.
      expect(text).toContain(`jusqu'à ${bonus} KAS`);
    }
    expect(CREATE_DEPOSIT_TERMS).toContain(`${sompiToKasText(CREATE_DEPOSIT_SOMPI)} KAS au plus`);
    for (const text of [COMMIT_REFUND_HIGHLIGHT, COMMIT_REFUND_SHORT]) {
      expect(text).toMatch(/intégralement/);
      expect(text).not.toMatch(/gratuit/i);
    }
  });
});
