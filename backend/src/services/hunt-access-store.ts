// Source d'autorité : état des chasses et rôles des wallets.
// TODO : remplacer par la lecture de l'état covenant / d'un indexer on-chain Kaspa.
import type { ChatRole, HuntAccessStatus, HuntOutcome } from "../types/auth.js";

export interface HuntAccessStore {
  getHuntStatus(huntId: string): HuntAccessStatus | undefined;
  getHuntOutcome(huntId: string): HuntOutcome | undefined;
  getWalletRole(huntId: string, walletFingerprint: string): ChatRole | undefined;
}

/** true si le chat peut exister : activée, ou résolue en succès. */
export function isChatAllowed(
  status: HuntAccessStatus | undefined,
  outcome?: HuntOutcome,
): boolean {
  return status === "activated" || (status === "settled" && outcome === "success");
}

/** Mémoire de développement uniquement. */
export class MockHuntAccessStore implements HuntAccessStore {
  private readonly hunts = new Map<string, { status: HuntAccessStatus; outcome?: HuntOutcome }>();
  private readonly roles = new Map<string, ChatRole>();

  getHuntStatus(huntId: string) {
    return this.hunts.get(huntId)?.status;
  }
  getHuntOutcome(huntId: string) {
    return this.hunts.get(huntId)?.outcome;
  }
  getWalletRole(huntId: string, walletFingerprint: string) {
    return this.roles.get(`${huntId}|${walletFingerprint}`);
  }

  // --- Seeds DEV ---
  seedHunt(h: { huntId: string; status: HuntAccessStatus; outcome?: HuntOutcome }) {
    this.hunts.set(
      h.huntId,
      h.outcome ? { status: h.status, outcome: h.outcome } : { status: h.status },
    );
  }
  seedRole(r: { huntId: string; walletFingerprint: string; role: ChatRole }) {
    const key = `${r.huntId}|${r.walletFingerprint}`;
    // Le rôle créateur n'est jamais rétrogradé.
    if (this.roles.get(key) === "creator") return;
    this.roles.set(key, r.role);
  }
}
