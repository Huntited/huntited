// Accès au chat d'une chasse : créateur ou engagé·e uniquement.
//   - mode "mock" : rôle déterminé localement, aucun appel réseau ;
//   - mode "api"  : jeton court demandé au backend à partir de la session
//                   signée du wallet ; le rôle vient du registre partagé.
// Aucune demande tant que la chasse n'est pas activée (ou résolue en succès).
import { useCallback, useEffect, useState } from "react";

import {
  ChatAccessError,
  obtainChatAccess,
  roleFromChatToken,
  type ChatAccessToken,
} from "./chat-access-api";
import { chatMode } from "./chat-client";
import { isCommitted } from "./hunt-repository";
import type { SettlementOutcome } from "./hunt-state-store";
import { canCreateRoom } from "./matrix-mock";
import type { HuntStatus } from "./types";
import { getUserHunts } from "./user-hunts";
import { useWallet } from "./useWallet";

export type ChatRole = "creator" | "participant";

export interface UseChatAccessResult {
  isAuthorized: boolean;
  role: ChatRole | null;
  isLoading: boolean;
  error: string | null;
  /** Jeton courant (null en mode mock ou s'il a expiré). */
  getAccessToken: () => string | null;
}

/** Rôle local (mock) : créateur si la chasse a été créée ici, engagé·e si engagement local. */
function localRole(huntId: string, address: string): ChatRole | null {
  if (getUserHunts(address).some((h) => h.huntId === huntId)) return "creator";
  if (isCommitted(huntId, address)) return "participant";
  return null;
}

const MSG_FORBIDDEN = "Le chat est réservé à la personne qui a créé la chasse et aux engagé·es.";
const MSG_UNAVAILABLE = "Le chat est temporairement indisponible.";
const MSG_SIGNATURE_REFUSED =
  "Signature refusée : signe le message dans ton wallet pour accéder au chat.";

export function useChatAccess(
  huntId: string,
  status: HuntStatus,
  outcome?: SettlementOutcome,
): UseChatAccessResult {
  const { address } = useWallet();
  const [role, setRole] = useState<ChatRole | null>(null);
  const [token, setToken] = useState<ChatAccessToken | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const allowed = canCreateRoom(status, outcome);

  useEffect(() => {
    // Réinitialise à chaque changement de wallet / statut (déconnexion incluse).
    setRole(null);
    setToken(null);
    setError(null);
    if (!allowed || !address) return;

    const r = localRole(huntId, address);
    if (chatMode === "mock") {
      if (r) setRole(r);
      else setError(MSG_FORBIDDEN);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    (async () => {
      // Session signée (une signature par visite), puis jeton de chat. Le
      // serveur décide du rôle et l'inscrit dans le jeton.
      const t = await obtainChatAccess({ huntId, walletAddress: address });
      if (cancelled) return;
      setToken(t);
      setRole(roleFromChatToken(t.accessToken) ?? r ?? "participant");
    })()
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(
          !(e instanceof ChatAccessError) || e.reason === "unavailable"
            ? MSG_UNAVAILABLE
            : e.reason === "signature_refused"
              ? MSG_SIGNATURE_REFUSED
              : MSG_FORBIDDEN,
        );
      })
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [huntId, status, outcome, address, allowed]);

  // Invalide le jeton à expiration.
  useEffect(() => {
    if (!token) return;
    const id = window.setTimeout(() => setToken(null), Math.max(0, token.expiresAt - Date.now()));
    return () => window.clearTimeout(id);
  }, [token]);

  const getAccessToken = useCallback(
    () => (token && token.expiresAt > Date.now() ? token.accessToken : null),
    [token],
  );

  const isAuthorized = allowed && role !== null && (chatMode === "mock" || token !== null);
  return { isAuthorized, role, isLoading, error, getAccessToken };
}
