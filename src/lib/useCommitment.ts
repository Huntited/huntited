import { useCallback, useEffect, useState } from "react";

import { commitToHunt } from "./covenants";
import { canCommit as statusAllowsCommit } from "./hunt-lifecycle";
import { hasMockCommitment, onCommitmentsChange } from "./mock-zk";
import type { HuntStatus } from "./types";
import { useWallet } from "./useWallet";

export interface UseCommitmentResult {
  isConnected: boolean;
  isCommitted: boolean;
  canCommit: boolean;
  isSubmitting: boolean;
  error: string | null;
  commit: () => Promise<void>;
}

/**
 * État d'engagement du wallet connecté pour une chasse.
 * Un wallet ne peut s'engager qu'une fois par chasse. Aucun log d'adresse
 * ni de commitment.
 */
export function useCommitment(huntId: string, status: HuntStatus): UseCommitmentResult {
  const { isConnected, address } = useWallet();
  const [isCommitted, setIsCommitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Relit l'état à chaque changement de wallet ou d'engagement.
  useEffect(() => {
    const sync = () => setIsCommitted(address ? hasMockCommitment(huntId, address) : false);
    sync();
    return onCommitmentsChange(sync);
  }, [huntId, address]);

  const canCommit = isConnected && statusAllowsCommit(status) && !isCommitted && !isSubmitting;

  const commit = useCallback(async () => {
    if (!address || !canCommit) return;
    setIsSubmitting(true);
    setError(null);
    try {
      // Le compteur se met à jour via onCommitmentsChange (déclenché par mockCommit).
      await commitToHunt(huntId, address);
    } catch (e) {
      setError(e instanceof Error ? e.message : "L'engagement a échoué. Réessaie.");
      throw e;
    } finally {
      setIsSubmitting(false);
    }
  }, [address, canCommit, huntId]);

  return { isConnected, isCommitted, canCommit, isSubmitting, error, commit };
}
