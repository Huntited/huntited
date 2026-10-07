import { useCallback, useEffect, useState } from "react";

import { getLocale, translate } from "./i18n";
import { toast } from "sonner";

import { guideBeforeConnect, needsGuide } from "./wallet-guide";

import {
  connectWallet as connect,
  disconnectWallet as disconnect,
  subscribeWallet,
  WalletError,
  type WalletState,
} from "./wallet";

export interface UseWalletResult {
  isConnected: boolean;
  address: string | null;
  isLoading: boolean;
  /** Dernière erreur de connexion, en texte affichable. */
  error: string | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
}

/**
 * Hook React autour du wallet. L'état initial est "déconnecté" pour que
 * le rendu serveur et le premier rendu client soient identiques ; l'état
 * réel est lu après hydratation.
 */
export function useWallet(): UseWalletResult {
  const [state, setState] = useState<WalletState>({ isConnected: false, address: null });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => subscribeWallet(setState), []);

  const connectWallet = useCallback(async () => {
    // Première connexion de Kastle : conseils « compte dédié » d'abord.
    if (needsGuide() && !(await guideBeforeConnect())) return;
    setIsLoading(true);
    setError(null);
    try {
      await connect();
    } catch (e) {
      // Message neutre : aucune adresse ni détail technique affiché.
      const message =
        e instanceof WalletError ? e.message : translate(getLocale(), "wallet.err.generic");
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { ...state, isLoading, error, connectWallet, disconnectWallet: disconnect };
}
