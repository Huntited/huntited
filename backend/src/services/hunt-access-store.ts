// Accès au chat : état des chasses et rôles des wallets.
// Implémenté par le registre partagé (hunt-registry.ts).
// TODO : remplacer par la lecture de l'état covenant / d'un indexer on-chain Kaspa.
import type { ChatRole, HuntAccessStatus, HuntOutcome } from "../types/auth.js";

export interface HuntAccessStore {
  getHuntStatus(huntId: string): HuntAccessStatus | undefined;
  getHuntOutcome(huntId: string): HuntOutcome | undefined;
  getWalletRole(huntId: string, walletKey: string): ChatRole | undefined;
}

/** true si le chat peut exister : activée, ou résolue en succès. */
export function isChatAllowed(
  status: HuntAccessStatus | undefined,
  outcome?: HuntOutcome,
): boolean {
  return status === "activated" || (status === "settled" && outcome === "success");
}
