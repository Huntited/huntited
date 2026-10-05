import { useCallback, useEffect, useState } from "react";

import {
  commit as commitToHunt,
  isCommitted as checkCommitted,
  onHuntsChange,
} from "./hunt-repository";
import { useWallet } from "./useWallet";

export interface UseCommitmentResult {
  isConnected: boolean;
  isCommitted: boolean;
  canCommit: boolean;
  isSubmitting: boolean;
  error: string | null;
  /** S'engage, avec un seuil personnel facultatif (« je viens si au moins N »). */
  commit: (personalThreshold?: number) => Promise<void>;
}

/**
 * État d'engagement du wallet connecté pour une chasse.
 * `commitsOpen` : engagements acceptés (active, ou activée avant la date limite).
 * Un wallet ne peut s'engager qu'une fois par chasse (vérifié aussi par le
 * registre en mode partagé). Aucun log d'adresse ni de commitment.
 */
export function useCommitment(huntId: string, commitsOpen: boolean): UseCommitmentResult {
  const { isConnected, address } = useWallet();
  const [isCommitted, setIsCommitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Relit l'état à chaque changement de wallet ou d'engagement.
  useEffect(() => {
    const sync = () => setIsCommitted(address ? checkCommitted(huntId, address) : false);
    sync();
    return onHuntsChange(sync);
  }, [huntId, address]);

  const canCommit = isConnected && commitsOpen && !isCommitted && !isSubmitting;

  const commit = useCallback(
    async (personalThreshold?: number) => {
      if (!address || !canCommit) return;
      setIsSubmitting(true);
      setError(null);
      try {
        // Le compteur se met à jour via onHuntsChange.
        await commitToHunt(huntId, address, personalThreshold);
      } catch (e) {
        setError(e instanceof Error ? e.message : "L'engagement a échoué. Réessaie.");
        throw e;
      } finally {
        setIsSubmitting(false);
      }
    },
    [address, canCommit, huntId],
  );

  return { isConnected, isCommitted, canCommit, isSubmitting, error, commit };
}
