/**
 * Cycle de vie d'une chasse (UI).
 *
 *   Créée → Active → Activée / Expirée → Résolue
 *                       ↓
 *                Chat Matrix ouvert
 *
 * Règle clé : l'activation prime sur l'expiration. L'état persisté
 * (hunt-state-store) est prioritaire, et "settled" n'est jamais recalculé.
 */
import type { SettlementOutcome, StoredHuntState } from "./hunt-state-store";
import type { Hunt, HuntStatus } from "./types";

export function deriveHuntStatus(
  hunt: Pick<Hunt, "status" | "threshold" | "deadline">,
  commitCount: number,
  now: number = Date.now(),
  stored?: StoredHuntState,
): HuntStatus {
  if (hunt.status === "settled" || stored?.status === "settled") return "settled";
  if (hunt.status === "draft") return "draft";
  if (stored?.status === "activated" || commitCount >= hunt.threshold) return "activated";
  if (now > new Date(hunt.deadline).getTime()) return "expired";
  return "active";
}

/** S'engager n'est possible que pendant la phase active. */
export function canCommit(status: HuntStatus): boolean {
  return status === "active";
}

/** Chat Matrix : après activation, ou après une résolution en succès. */
export function canOpenChat(status: HuntStatus, outcome?: SettlementOutcome): boolean {
  return status === "activated" || (status === "settled" && outcome === "success");
}

/** La résolution économique est possible après activation ou expiration. */
export function canSettle(status: HuntStatus): boolean {
  return status === "activated" || status === "expired";
}

/** Issue de la résolution : succès si activée, échec si expirée. */
export function getSettlementOutcome(status: HuntStatus): SettlementOutcome | undefined {
  if (status === "activated") return "success";
  if (status === "expired") return "failure";
  return undefined;
}
