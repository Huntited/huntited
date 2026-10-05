import { useCallback, useEffect, useState } from "react";

import {
  getCommitCount,
  getHunt,
  getHuntCovenant,
  onCommitmentsChange,
  type HuntCovenant,
} from "./covenants";
import { deriveHuntStatus } from "./hunt-lifecycle";
import {
  deriveAndPersistHuntState,
  subscribeHuntState,
  type SettlementOutcome,
} from "./hunt-state-store";
import type { Hunt, HuntStatus } from "./types";

export interface UseHuntResult {
  hunt: Hunt | undefined;
  covenant: HuntCovenant | undefined;
  commitCount: number;
  status: HuntStatus;
  /** Issue de la résolution persistée (si résolue). */
  outcome: SettlementOutcome | undefined;
  isLoading: boolean;
  refresh: () => void;
}

/**
 * Hook pour charger et suivre l'état d'une chasse.
 *
 * Pour l'instant :
 * - hunt vient de la couche covenant mockée (démos + créations locales).
 * - commitCount vient du mock ZK (commitments locaux).
 * - status est calculé localement (deadline + seuil).
 *
 * Plus tard :
 * - hunt et covenant viendront d'un registry on-chain Kaspa.
 * - commitCount sera prouvé par ZK, sans exposer les engagements.
 *
 * Privacy-first : aucune donnée personnelle n'est lue ni loguée ici.
 */
export function useHunt(huntId: string): UseHuntResult {
  const [hunt, setHunt] = useState<Hunt | undefined>();
  const [covenant, setCovenant] = useState<HuntCovenant | undefined>();
  const [commitCount, setCommitCount] = useState(0);
  const [status, setStatus] = useState<HuntStatus>("active");
  const [outcome, setOutcome] = useState<SettlementOutcome | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [version, setVersion] = useState(0); // incrémenté pour forcer un refresh

  useEffect(() => {
    setIsLoading(true);

    // Lecture via la couche covenant (remplaçable par un appel on-chain)
    const base = getHunt(huntId);
    if (base) {
      const count = getCommitCount(base);
      // Persiste activation / expiration (settled jamais écrasé).
      const stored = deriveAndPersistHuntState(base, count);
      const found: Hunt = {
        ...base,
        ...(stored.activatedAt ? { activatedAt: stored.activatedAt } : {}),
        ...(stored.settledAt ? { settledAt: stored.settledAt } : {}),
      };
      setHunt(found);
      setCommitCount(count);
      setCovenant(getHuntCovenant(found));
      setStatus(deriveHuntStatus(base, count, Date.now(), stored));
      setOutcome(stored.settlementOutcome);
    } else {
      setHunt(undefined);
      setOutcome(undefined);
      setCovenant(undefined);
      setCommitCount(0);
      setStatus("active");
    }

    setIsLoading(false);
  }, [huntId, version]);

  // Re-render automatique quand un engagement est confirmé sur cet appareil
  useEffect(() => onCommitmentsChange(() => setVersion((v) => v + 1)), []);
  useEffect(() => subscribeHuntState(() => setVersion((v) => v + 1)), []);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  return { hunt, covenant, commitCount, status, outcome, isLoading, refresh };
}
