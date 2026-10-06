/**
 * Économie Huntited — source de vérité du MVP.
 *
 * S'engager ne coûte rien : le dépôt d'engagement (5 KAS) est toujours rendu
 * à la fin. Le créateur bloque une caution C (30 KAS au moins, au choix) et
 * n'y gagne jamais rien : on lui en rend une partie, au plus la totalité.
 * Tout est proportionnel à C :
 * - Succès : 47,5 % de C partagés à parts égales entre les engagé·es
 *   retenu·es, plafonnés à C / 30 chacun (1 KAS pour 30 KAS de caution) ;
 *   2,5 % de C à la treasury ; le reste est rendu au créateur (≥ 50 %).
 * - Échec : aucune récompense (rien à gagner en engageant des bots sur une
 *   chasse vouée à l'échec) ; C / 30 à la treasury, le reste est rendu.
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

/** Caution minimale (et par défaut) ; le créateur peut en mettre plus. */
export const MIN_CAUTION_KAS = 30;
export const MAX_CAUTION_KAS = 100_000;
export const CREATE_DEPOSIT_SOMPI = BigInt(MIN_CAUTION_KAS) * SOMPI_PER_KAS;
export const COMMIT_DEPOSIT_SOMPI = 5n * SOMPI_PER_KAS;

/** Seuil minimum d'une chasse (voir l'en-tête). */
export const MIN_THRESHOLD = 7;

/** Parts de la caution, en pour mille. */
const SUCCESS_PARTICIPANTS_PERMILLE = 475n; // 47,5 % aux engagé·es (avant plafond)
const SUCCESS_TREASURY_PERMILLE = 25n; // 2,5 %
/** Plafond par engagé et frais d'échec : 1/30 de la caution (1 KAS pour 30). */
const CAP_AND_FAILURE_DIVISOR = 30n;

export type HuntOutcome = "success" | "failure";

export interface HuntSettlement {
  /** Part de la caution rendue au créateur. */
  creatorCreationRefundSompi: bigint;
  /** Part de la caution versée à la treasury. */
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

/** Montants clés d'une caution (affichage des règles, sans engagés). */
export function cautionTerms(cautionSompi: bigint = CREATE_DEPOSIT_SOMPI) {
  return {
    /** Succès : total maximal partagé entre les engagé·es. */
    successPoolSompi: (cautionSompi * SUCCESS_PARTICIPANTS_PERMILLE) / 1000n,
    /** Succès : plafond par engagé·e. */
    capPerCommitSompi: cautionSompi / CAP_AND_FAILURE_DIVISOR,
    successTreasurySompi: (cautionSompi * SUCCESS_TREASURY_PERMILLE) / 1000n,
    failureTreasurySompi: cautionSompi / CAP_AND_FAILURE_DIVISOR,
  };
}

/**
 * Règlement d'une chasse, pour une caution donnée (30 KAS par défaut).
 * - Succès : `commitCount` = engagé·es **retenu·es** (dépôt rendu + part de la
 *   récompense) ; les non-retenu·es récupèrent leur dépôt
 *   (nonRetainedRefundPerCommitSompi).
 * - Échec : `commitCount` = tous les engagé·es (dépôt rendu, sans récompense).
 */
export function calculateSettlement(
  commitCount: number,
  outcome: HuntOutcome,
  cautionSompi: bigint = CREATE_DEPOSIT_SOMPI,
): HuntSettlement {
  if (!Number.isSafeInteger(commitCount) || commitCount < 0) {
    throw new Error("Nombre d'engagements invalide.");
  }
  if (cautionSompi < CREATE_DEPOSIT_SOMPI) throw new Error("Caution insuffisante.");

  const n = BigInt(commitCount);
  const success = outcome === "success";
  const terms = cautionTerms(cautionSompi);
  const treasurySompi = success ? terms.successTreasurySompi : terms.failureTreasurySompi;
  const evenShare = n > 0n ? terms.successPoolSompi / n : 0n;
  const share = !success
    ? 0n
    : evenShare < terms.capPerCommitSompi
      ? evenShare
      : terms.capPerCommitSompi;

  return {
    creatorCreationRefundSompi: cautionSompi - treasurySompi - share * n,
    treasurySompi,
    participantRefundPerCommitSompi: COMMIT_DEPOSIT_SOMPI,
    participantBonusPerCommitSompi: share,
    nonRetainedRefundPerCommitSompi: success ? COMMIT_DEPOSIT_SOMPI : 0n,
  };
}

/** Formate des sompis en texte KAS sans passer par un flottant (affichage uniquement). */
export function sompiToKasText(amountSompi: bigint): string {
  const whole = amountSompi / SOMPI_PER_KAS;
  const fraction = amountSompi % SOMPI_PER_KAS;
  if (fraction === 0n) return `${whole}`;
  return `${whole}.${fraction.toString().padStart(8, "0").replace(/0+$/, "")}`;
}

/** Montant affichable en français (virgule décimale, 2 décimales au plus). */
export function sompiToKasFr(amountSompi: bigint): string {
  const rounded = ((amountSompi + 500_000n) / 1_000_000n) * 1_000_000n; // centièmes
  return sompiToKasText(rounded).replace(".", ",");
}
