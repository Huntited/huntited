/**
 * Économie Huntited — source de vérité du MVP.
 *
 * La caution du créateur (30 KAS) est partagée avec les engagé·es :
 * - Succès : 95 % de la caution est partagée à parts égales entre les
 *   engagé·es retenu·es, 5 % va à la treasury. Les dépôts d'engagement
 *   (5 KAS × N retenu·es) vont 95 % au créateur, 5 % à la treasury.
 * - Échec : chaque engagé récupère ses 5 KAS ; 47,5 % de la caution est
 *   partagée à parts égales entre tous les engagés, 2,5 % va à la treasury,
 *   le créateur récupère les 50 % restants.
 * Les parts sont arrondies au sompi inférieur ; le reste (et toute part sans
 * destinataire) revient au créateur.
 * Le seuil minimum (MIN_THRESHOLD) garantit qu'un créateur ne perd pas
 * d'argent quand son action réussit : 95 % de 7 × 5 KAS ≥ 30 KAS.
 *
 * Montants en sompis (bigint) uniquement. Aucune notion de présence,
 * vérification ou mission n'influence les paiements.
 */

export const SOMPI_PER_KAS = 100_000_000n;

export const CREATE_DEPOSIT_SOMPI = 30n * SOMPI_PER_KAS;
export const COMMIT_DEPOSIT_SOMPI = 5n * SOMPI_PER_KAS;

/** Seuil minimum d'une chasse (voir l'en-tête). */
export const MIN_THRESHOLD = 7;

/** Parts de la caution, en points de base (10 000 = 100 %). */
const BPS = 10_000n;
export const SUCCESS_CAUTION_SHARE_BPS = 9_500n; // 95 % aux engagé·es retenu·es
export const SUCCESS_CAUTION_TREASURY_BPS = 500n; // 5 %
export const FAILURE_CAUTION_SHARE_BPS = 4_750n; // 47,5 % aux engagé·es
export const FAILURE_CAUTION_TREASURY_BPS = 250n; // 2,5 %

export type HuntOutcome = "success" | "failure";

export interface HuntSettlement {
  /** Part de la caution rendue au créateur. */
  creatorCreationRefundSompi: bigint;
  creatorCommitRewardSompi: bigint;
  /** Total treasury : part de la caution + 5 % des engagements (succès). */
  treasurySompi: bigint;
  /** Dépôt d'engagement rendu à chaque engagé (échec uniquement). */
  participantRefundPerCommitSompi: bigint;
  /** Part de la caution versée à chaque engagé·e (retenu·e en cas de succès). */
  participantBonusPerCommitSompi: bigint;
  /**
   * Succès uniquement : dépôt rendu à chaque engagé·e NON retenu·e (son seuil
   * personnel n'est pas atteint), sans part de la caution — voir
   * docs/seuil-personnel.md.
   */
  nonRetainedRefundPerCommitSompi: bigint;
}

/** Part de la caution reçue par chacun de `commitCount` engagé·es. */
export function cautionSharePerCommit(commitCount: number, outcome: HuntOutcome): bigint {
  if (commitCount <= 0) return 0n;
  const bps = outcome === "success" ? SUCCESS_CAUTION_SHARE_BPS : FAILURE_CAUTION_SHARE_BPS;
  return (CREATE_DEPOSIT_SOMPI * bps) / BPS / BigInt(commitCount);
}

/**
 * Règlement d'une chasse.
 * - Succès : `commitCount` = engagé·es **retenu·es** (leurs dépôts financent
 *   le créateur à 95 % et la treasury à 5 % ; ils se partagent 95 % de la
 *   caution) ; les non-retenu·es récupèrent leur dépôt
 *   (nonRetainedRefundPerCommitSompi).
 * - Échec : `commitCount` = tous les engagé·es (remboursement + part de la caution).
 */
export function calculateSettlement(commitCount: number, outcome: HuntOutcome): HuntSettlement {
  if (!Number.isSafeInteger(commitCount) || commitCount < 0) {
    throw new Error("Nombre d'engagements invalide.");
  }

  const n = BigInt(commitCount);
  const share = cautionSharePerCommit(commitCount, outcome);
  const cautionTreasury =
    (CREATE_DEPOSIT_SOMPI *
      (outcome === "success" ? SUCCESS_CAUTION_TREASURY_BPS : FAILURE_CAUTION_TREASURY_BPS)) /
    BPS;
  const creatorCreationRefundSompi = CREATE_DEPOSIT_SOMPI - cautionTreasury - share * n;

  if (outcome === "failure") {
    return {
      creatorCreationRefundSompi,
      creatorCommitRewardSompi: 0n,
      treasurySompi: cautionTreasury,
      participantRefundPerCommitSompi: COMMIT_DEPOSIT_SOMPI,
      participantBonusPerCommitSompi: share,
      nonRetainedRefundPerCommitSompi: 0n,
    };
  }

  const totalCommitDepositsSompi = n * COMMIT_DEPOSIT_SOMPI;
  const commitTreasury = totalCommitDepositsSompi / 20n; // 5 %
  return {
    creatorCreationRefundSompi,
    creatorCommitRewardSompi: totalCommitDepositsSompi - commitTreasury, // 95 %
    treasurySompi: cautionTreasury + commitTreasury,
    participantRefundPerCommitSompi: 0n,
    participantBonusPerCommitSompi: share,
    nonRetainedRefundPerCommitSompi: COMMIT_DEPOSIT_SOMPI,
  };
}

/** Formate des sompis en texte KAS sans passer par un flottant (affichage uniquement). */
export function sompiToKasText(amountSompi: bigint): string {
  const whole = amountSompi / SOMPI_PER_KAS;
  const fraction = amountSompi % SOMPI_PER_KAS;
  if (fraction === 0n) return `${whole}`;
  return `${whole}.${fraction.toString().padStart(8, "0").replace(/0+$/, "")}`;
}
