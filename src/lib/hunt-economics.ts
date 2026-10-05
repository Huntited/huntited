/**
 * Économie Huntited — source de vérité du MVP.
 *
 * Succès : le créateur récupère ses 30 KAS ; les dépôts d'engagement
 * (5 KAS × N) vont 95 % au créateur, 5 % au treasury ; les engagé·es
 * reçoivent 0 KAS.
 * Échec : chaque engagé récupère ses 5 KAS plus un bonus d'échec de 1 KAS,
 * pris sur le dépôt de création du créateur (bonus total plafonné à 30 KAS,
 * partagé à parts égales au-delà de 30 engagés) ; le créateur récupère le
 * reste de ses 30 KAS ; le treasury reçoit 0.
 * Le bonus rend l'engagement avantageux même si la chasse échoue
 * (contrat d'assurance dominant).
 *
 * Montants en sompis (bigint) uniquement. Aucune notion de présence,
 * vérification ou mission n'influence les paiements.
 */

export const SOMPI_PER_KAS = 100_000_000n;

export const CREATE_DEPOSIT_SOMPI = 30n * SOMPI_PER_KAS;
export const COMMIT_DEPOSIT_SOMPI = 5n * SOMPI_PER_KAS;
/** Bonus d'échec versé à chaque engagé, avant plafonnement. */
export const FAILURE_BONUS_PER_COMMIT_SOMPI = 1n * SOMPI_PER_KAS;

export type HuntOutcome = "success" | "failure";

export interface HuntSettlement {
  /** Part du dépôt de création rendue au créateur. */
  creatorCreationRefundSompi: bigint;
  creatorCommitRewardSompi: bigint;
  treasurySompi: bigint;
  /** Dépôt d'engagement rendu à chaque engagé (échec uniquement). */
  participantRefundPerCommitSompi: bigint;
  /** Bonus d'échec versé à chaque engagé (échec uniquement). */
  participantBonusPerCommitSompi: bigint;
}

/**
 * Bonus d'échec par engagé : 1 KAS, sauf si le total dépasserait le dépôt
 * de création (30 KAS) — il est alors partagé à parts égales, arrondi à
 * l'inférieur au sompi près (le reste revient au créateur).
 */
export function failureBonusPerCommit(commitCount: number): bigint {
  if (commitCount === 0) return 0n;
  const n = BigInt(commitCount);
  const pool = n * FAILURE_BONUS_PER_COMMIT_SOMPI;
  return pool <= CREATE_DEPOSIT_SOMPI ? FAILURE_BONUS_PER_COMMIT_SOMPI : CREATE_DEPOSIT_SOMPI / n;
}

export function calculateSettlement(commitCount: number, outcome: HuntOutcome): HuntSettlement {
  if (!Number.isSafeInteger(commitCount) || commitCount < 0) {
    throw new Error("Nombre d'engagements invalide.");
  }

  const totalCommitDepositsSompi = BigInt(commitCount) * COMMIT_DEPOSIT_SOMPI;

  if (outcome === "failure") {
    const bonus = failureBonusPerCommit(commitCount);
    return {
      creatorCreationRefundSompi: CREATE_DEPOSIT_SOMPI - bonus * BigInt(commitCount),
      creatorCommitRewardSompi: 0n,
      treasurySompi: 0n,
      participantRefundPerCommitSompi: COMMIT_DEPOSIT_SOMPI,
      participantBonusPerCommitSompi: bonus,
    };
  }

  const treasurySompi = totalCommitDepositsSompi / 20n; // 5 %
  const creatorCommitRewardSompi = totalCommitDepositsSompi - treasurySompi; // 95 %

  return {
    creatorCreationRefundSompi: CREATE_DEPOSIT_SOMPI,
    creatorCommitRewardSompi,
    treasurySompi,
    participantRefundPerCommitSompi: 0n,
    participantBonusPerCommitSompi: 0n,
  };
}

/** Formate des sompis en texte KAS sans passer par un flottant (affichage uniquement). */
export function sompiToKasText(amountSompi: bigint): string {
  const whole = amountSompi / SOMPI_PER_KAS;
  const fraction = amountSompi % SOMPI_PER_KAS;
  if (fraction === 0n) return `${whole}`;
  return `${whole}.${fraction.toString().padStart(8, "0").replace(/0+$/, "")}`;
}
