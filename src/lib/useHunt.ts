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
  /** Groupe retenu (seuils personnels) ; null si masqué. */
  retainedCount: number | null;
  retainedThreshold: number | null;
  activationRank: number | undefined;
  /** Engagements encore acceptés (y compris après l'activation, jusqu'à la date limite). */
  commitsOpen: boolean;
  isLoading: boolean;
  /** Erreur de chargement (service indisponible en mode registre). */
  error: string | null;
  /** Mode chaîne : chasse envoyée, pas encore vue par l'index. */
  pending: boolean;
  /** Mode chaîne : date limite passée, résultat encore en vérification. */
  outcomePending: boolean;
  /** Masquée par la modération : raison (mode chaîne). */
  hidden: string | null;
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
  const [group, setGroup] = useState<{
    retainedCount: number | null;
    retainedThreshold: number | null;
    activationRank: number | undefined;
    commitsOpen: boolean;
  }>({
    retainedCount: null,
    retainedThreshold: null,
    activationRank: undefined,
    commitsOpen: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [outcomePending, setOutcomePending] = useState(false);
  const [hidden, setHidden] = useState<string | null>(null);
  const [version, setVersion] = useState(0); // incrémenté pour forcer un refresh

  useEffect(() => {
    let cancelled = false;
    getHuntView(huntId)
      .then((view) => {
        if (cancelled) return;
        setError(null);
        setPending(view?.pending ?? false);
        setOutcomePending(view?.outcomePending ?? false);
        setHidden(view?.hidden ?? null);
        setHunt(view?.hunt);
        setCommitCount(view?.commitCount ?? 0);
        setStatus(view?.status ?? "active");
        setOutcome(view?.outcome);
        setGroup({
          retainedCount: view?.retainedCount ?? null,
          retainedThreshold: view?.retainedThreshold ?? null,
          activationRank: view?.activationRank,
          commitsOpen: view?.commitsOpen ?? false,
        });
      })
      .catch(() => {
        if (!cancelled) setError("Impossible de charger l'action. Réessaie plus tard.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [huntId, version]);

  useEffect(() => onHuntsChange(() => setVersion((v) => v + 1)), []);

  // En attente de l'index (chasse envoyée, ou résultat en vérification) : on relit toutes les 15 s.
  const waiting = pending || outcomePending;
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => setVersion((v) => v + 1), 15_000);
    return () => clearInterval(timer);
  }, [waiting]);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  const covenant = hunt ? getHuntCovenant(hunt) : undefined;

  return {
    hunt,
    covenant,
    commitCount,
    status,
    outcome,
    ...group,
    isLoading,
    error,
    pending,
    outcomePending,
    hidden,
    refresh,
  };
}
