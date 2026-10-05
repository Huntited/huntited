/**
 * Économie Huntited — source de vérité du MVP.
 *
 * Succès : le créateur récupère ses 30 KAS ; les dépôts d'engagement
 * (5 KAS × N) vont 95 % au créateur, 5 % au treasury ; les engagé·es
 * reçoivent 0 KAS.
 * Échec : le créateur récupère ses 30 KAS, chaque engagé ses 5 KAS,
 * le treasury 0.
 *
 * Montants en sompis (bigint) uniquement. Aucune notion de présence,
 * vérification ou mission n'influence les paiements.
 */

export const SOMPI_PER_KAS = 100_000_000n;

export const CREATE_DEPOSIT_SOMPI = 30n * SOMPI_PER_KAS;
export const COMMIT_DEPOSIT_SOMPI = 5n * SOMPI_PER_KAS;

export type HuntOutcome = "success" | "failure";

export interface HuntSettlement {
  creatorCreationRefundSompi: bigint;
  creatorCommitRewardSompi: bigint;
  treasurySompi: bigint;
  participantRefundPerCommitSompi: bigint;
}

export function calculateSettlement(commitCount: number, outcome: HuntOutcome): HuntSettlement {
  if (!Number.isSafeInteger(commitCount) || commitCount < 0) {
    throw new Error("Nombre d'engagements invalide.");
  }

  const totalCommitDepositsSompi = BigInt(commitCount) * COMMIT_DEPOSIT_SOMPI;

  if (outcome === "failure") {
    return {
      creatorCreationRefundSompi: CREATE_DEPOSIT_SOMPI,
      creatorCommitRewardSompi: 0n,
      treasurySompi: 0n,
      participantRefundPerCommitSompi: COMMIT_DEPOSIT_SOMPI,
    };
  }

  const treasurySompi = totalCommitDepositsSompi / 20n; // 5 %
  const creatorCommitRewardSompi = totalCommitDepositsSompi - treasurySompi; // 95 %

  return {
    creatorCreationRefundSompi: CREATE_DEPOSIT_SOMPI,
    creatorCommitRewardSompi,
    treasurySompi,
    participantRefundPerCommitSompi: 0n,
  };
}

/** Formate des sompis en texte KAS sans passer par un flottant (affichage uniquement). */
export function sompiToKasText(amountSompi: bigint): string {
  const whole = amountSompi / SOMPI_PER_KAS;
  const fraction = amountSompi % SOMPI_PER_KAS;
  if (fraction === 0n) return `${whole}`;
  return `${whole}.${fraction.toString().padStart(8, "0").replace(/0+$/, "")}`;
}
