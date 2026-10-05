import { useCallback, useEffect, useState } from "react";

import { getHuntCovenant, type HuntCovenant } from "./covenants";
import type { SettlementOutcome } from "./hunt-state-store";
import { getHuntView, onHuntsChange } from "./hunt-repository";
import type { Hunt, HuntStatus } from "./types";

export interface UseHuntResult {
  hunt: Hunt | undefined;
  covenant: HuntCovenant | undefined;
  /** Nombre d'engagés ; 0 quand il est masqué (voir isProgressVisible). */
  commitCount: number;
  status: HuntStatus;
  /** Issue de la résolution (si résolue). */
  outcome: SettlementOutcome | undefined;
  isLoading: boolean;
  /** Erreur de chargement (service indisponible en mode registre). */
  error: string | null;
  refresh: () => void;
}

/**
 * Charge et suit l'état d'une chasse via hunt-repository :
 * mock local ou registre partagé selon VITE_DATA_MODE.
 * Privacy-first : aucune donnée personnelle n'est lue ni loguée ici.
 */
export function useHunt(huntId: string): UseHuntResult {
  const [hunt, setHunt] = useState<Hunt | undefined>();
  const [commitCount, setCommitCount] = useState(0);
  const [status, setStatus] = useState<HuntStatus>("active");
  const [outcome, setOutcome] = useState<SettlementOutcome | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0); // incrémenté pour forcer un refresh

  useEffect(() => {
    let cancelled = false;
    getHuntView(huntId)
      .then((view) => {
        if (cancelled) return;
        setError(null);
        setHunt(view?.hunt);
        setCommitCount(view?.commitCount ?? 0);
        setStatus(view?.status ?? "active");
        setOutcome(view?.outcome);
      })
      .catch(() => {
        if (!cancelled) setError("Impossible de charger la chasse. Réessaie plus tard.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [huntId, version]);

  useEffect(() => onHuntsChange(() => setVersion((v) => v + 1)), []);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  const covenant = hunt ? getHuntCovenant(hunt) : undefined;

  return { hunt, covenant, commitCount, status, outcome, isLoading, error, refresh };
}
