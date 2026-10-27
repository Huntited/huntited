import { useCallback, useEffect, useState } from "react";

import {
  commit as commitToHunt,
  getDataMode,
  isCommitted as checkCommitted,
  onHuntsChange,
  withdraw as withdrawFromHunt,
} from "./hunt-repository";
import { getLocale, translate } from "./i18n";
import { useWallet } from "./useWallet";

export interface UseCommitmentResult {
  isConnected: boolean;
  isCommitted: boolean;
  canCommit: boolean;
  isSubmitting: boolean;
  error: string | null;
  /**
   * S'engage, avec un seuil personnel facultatif (« je viens si au moins N »)
   * et, en mode chaîne, une condition facultative (autre chasse déclenchée).
   */
  commit: (personalThreshold?: number, after?: string) => Promise<void>;
  /** Retrait possible : engagé·e, chasse ouverte et pas encore déclenchée (mode chaîne). */
  canWithdraw: boolean;
  withdraw: () => Promise<void>;
}

/**
 * État d'engagement du wallet connecté pour une chasse.
 * `commitsOpen` : engagements acceptés (active, ou activée avant la date limite).
 * Un wallet ne peut s'engager qu'une fois par chasse (vérifié aussi par le
 * registre en mode partagé). Aucun log d'adresse ni de commitment.
 */
export function useCommitment(
  huntId: string,
  commitsOpen: boolean,
  /** Chasse déjà déclenchée : plus de retrait possible. */
  activated = false,
): UseCommitmentResult {
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
  const canWithdraw =
    isConnected &&
    commitsOpen &&
    !activated &&
    isCommitted &&
    !isSubmitting &&
    getDataMode() === "chain";

  const commit = useCallback(
    async (personalThreshold?: number, after?: string) => {
      if (!address || !canCommit) return;
      setIsSubmitting(true);
      setError(null);
      try {
        // Le compteur se met à jour via onHuntsChange.
        await commitToHunt(huntId, address, personalThreshold, after);
      } catch (e) {
        setError(e instanceof Error ? e.message : translate(getLocale(), "err.commit"));
        throw e;
      } finally {
        setIsSubmitting(false);
      }
    },
    [address, canCommit, huntId],
  );

  const withdraw = useCallback(async () => {
    if (!address || !canWithdraw) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await withdrawFromHunt(huntId, address);
    } catch (e) {
      setError(e instanceof Error ? e.message : translate(getLocale(), "err.withdraw"));
      throw e;
    } finally {
      setIsSubmitting(false);
    }
  }, [address, canWithdraw, huntId]);

  return {
    isConnected,
    isCommitted,
    canCommit,
    isSubmitting,
    error,
    commit,
    canWithdraw,
    withdraw,
  };
}
