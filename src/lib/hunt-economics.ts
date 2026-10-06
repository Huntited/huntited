/**
 * Économie Huntited — source de vérité du MVP.
 *
 * S'engager ne coûte rien : le dépôt d'engagement (5 KAS) est toujours rendu
 * à la fin. Le créateur finance une récompense prise sur sa caution (30 KAS) :
 * - Succès : récompense de 15 KAS, 95 % partagés à parts égales entre les
 *   engagé·es retenu·es, 5 % à la treasury ; le créateur récupère 15 KAS.
 * - Échec : récompense de 20 KAS, 95 % partagés à parts égales entre tous
 *   les engagés, 5 % à la treasury ; le créateur récupère 10 KAS.
 * Les parts sont arrondies au sompi inférieur ; le reste (et toute part sans
 * destinataire) revient au créateur.
 * Seuil minimum (MIN_THRESHOLD) : des actions vraiment collectives, et une
 * récompense plus difficile à récupérer avec ses propres wallets.
 *
 * Montants en sompis (bigint) uniquement. Aucune notion de présence,
 * vérification ou mission n'influence les paiements.
 */

export const SOMPI_PER_KAS = 100_000_000n;

export const CREATE_DEPOSIT_SOMPI = 30n * SOMPI_PER_KAS;
export const COMMIT_DEPOSIT_SOMPI = 5n * SOMPI_PER_KAS;

/** Seuil minimum d'une chasse (voir l'en-tête). */
export const MIN_THRESHOLD = 7;

/** Récompense prise sur la caution, selon l'issue. */
export const SUCCESS_REWARD_SOMPI = 15n * SOMPI_PER_KAS;
export const FAILURE_REWARD_SOMPI = 20n * SOMPI_PER_KAS;
/** Part de la récompense versée aux engagé·es (le reste va à la treasury). */
export const REWARD_PARTICIPANTS_PERCENT = 95n;

export type HuntOutcome = "success" | "failure";

export interface HuntSettlement {
  /** Part de la caution rendue au créateur. */
  creatorCreationRefundSompi: bigint;
  /** Treasury : 5 % de la récompense. */
  treasurySompi: bigint;
  /** Dépôt d'engagement rendu à chaque engagé·e (retenu·e en cas de succès). */
  participantRefundPerCommitSompi: bigint;
  /** Part de la récompense versée à chaque engagé·e (retenu·e en cas de succès). */
  participantBonusPerCommitSompi: bigint;
  /**
   * Succès uniquement : dépôt rendu à chaque engagé·e NON retenu·e (son seuil
   * personnel n'est pas atteint), sans part de la récompense — voir
   * docs/seuil-personnel.md.
   */
  nonRetainedRefundPerCommitSompi: bigint;
}

/** Récompense totale (engagés + treasury) selon l'issue. */
export function rewardPool(outcome: HuntOutcome): bigint {
  return outcome === "success" ? SUCCESS_REWARD_SOMPI : FAILURE_REWARD_SOMPI;
}

/** Part de la récompense destinée à l'ensemble des engagé·es. */
export function participantsRewardPool(outcome: HuntOutcome): bigint {
  return (rewardPool(outcome) * REWARD_PARTICIPANTS_PERCENT) / 100n;
}

/**
 * Règlement d'une chasse.
 * - Succès : `commitCount` = engagé·es **retenu·es** (dépôt rendu + part de la
 *   récompense) ; les non-retenu·es récupèrent leur dépôt
 *   (nonRetainedRefundPerCommitSompi).
 * - Échec : `commitCount` = tous les engagé·es (dépôt rendu + part de la récompense).
 */
export function calculateSettlement(commitCount: number, outcome: HuntOutcome): HuntSettlement {
  if (!Number.isSafeInteger(commitCount) || commitCount < 0) {
    throw new Error("Nombre d'engagements invalide.");
  }

  const n = BigInt(commitCount);
  const participantsPool = participantsRewardPool(outcome);
  const treasurySompi = rewardPool(outcome) - participantsPool;
  const share = n > 0n ? participantsPool / n : 0n;

  return {
    creatorCreationRefundSompi: CREATE_DEPOSIT_SOMPI - treasurySompi - share * n,
    treasurySompi,
    participantRefundPerCommitSompi: COMMIT_DEPOSIT_SOMPI,
    participantBonusPerCommitSompi: share,
    nonRetainedRefundPerCommitSompi: outcome === "success" ? COMMIT_DEPOSIT_SOMPI : 0n,
  };
}

/** Formate des sompis en texte KAS sans passer par un flottant (affichage uniquement). */
export function sompiToKasText(amountSompi: bigint): string {
  const whole = amountSompi / SOMPI_PER_KAS;
  const fraction = amountSompi % SOMPI_PER_KAS;
  if (fraction === 0n) return `${whole}`;
  return `${whole}.${fraction.toString().padStart(8, "0").replace(/0+$/, "")}`;
}
