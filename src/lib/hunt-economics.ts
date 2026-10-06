/**
 * Économie Huntited — source de vérité du MVP.
 *
 * S'engager ne coûte rien : le dépôt d'engagement (5 KAS) est toujours rendu
 * à la fin. Le créateur finance, sur sa caution (30 KAS) :
 * - Succès : une récompense de 15 KAS au plus — 14,25 KAS au plus partagés à
 *   parts égales entre les engagé·es retenu·es, plafonnés à 1 KAS chacun,
 *   et 0,75 KAS à la treasury ; le créateur récupère le reste (≥ 15 KAS).
 * - Échec : aucune récompense (rien à gagner en engageant des bots sur une
 *   chasse vouée à l'échec) ; 1 KAS à la treasury, le créateur récupère 29 KAS.
 * Le plafond par engagé limite ce qu'un créateur récupère en s'engageant
 * avec ses propres wallets. Les parts sont arrondies au sompi inférieur ; le
 * reste revient au créateur.
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

/** Récompense de succès prise sur la caution (engagés + treasury). */
export const SUCCESS_REWARD_SOMPI = 15n * SOMPI_PER_KAS;
/** Part de la récompense destinée aux engagé·es (le reste va à la treasury). */
export const REWARD_PARTICIPANTS_PERCENT = 95n;
/** Plafond de récompense par engagé·e. */
export const REWARD_CAP_PER_COMMIT_SOMPI = 1n * SOMPI_PER_KAS;
/** Échec : frais pris sur la caution pour la treasury (aucune récompense). */
export const FAILURE_FEE_SOMPI = 1n * SOMPI_PER_KAS;

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

/** Récompense de succès destinée à l'ensemble des engagé·es (avant plafond). */
export const SUCCESS_PARTICIPANTS_POOL_SOMPI =
  (SUCCESS_REWARD_SOMPI * REWARD_PARTICIPANTS_PERCENT) / 100n;

/**
 * Règlement d'une chasse.
 * - Succès : `commitCount` = engagé·es **retenu·es** (dépôt rendu + part de la
 *   récompense) ; les non-retenu·es récupèrent leur dépôt
 *   (nonRetainedRefundPerCommitSompi).
 * - Échec : `commitCount` = tous les engagé·es (dépôt rendu, sans récompense).
 */
export function calculateSettlement(commitCount: number, outcome: HuntOutcome): HuntSettlement {
  if (!Number.isSafeInteger(commitCount) || commitCount < 0) {
    throw new Error("Nombre d'engagements invalide.");
  }

  const n = BigInt(commitCount);
  const success = outcome === "success";
  const treasurySompi = success
    ? SUCCESS_REWARD_SOMPI - SUCCESS_PARTICIPANTS_POOL_SOMPI
    : FAILURE_FEE_SOMPI;
  const evenShare = n > 0n ? SUCCESS_PARTICIPANTS_POOL_SOMPI / n : 0n;
  const share = !success
    ? 0n
    : evenShare < REWARD_CAP_PER_COMMIT_SOMPI
      ? evenShare
      : REWARD_CAP_PER_COMMIT_SOMPI;

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
