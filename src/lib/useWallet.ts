import { useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import { getLocale, translate } from "./i18n";
import { toast } from "sonner";

import { guideBeforeConnect, needsGuide } from "./wallet-guide";
import { pickWallet } from "./wallet-picker";
import { grantPagePass, isProtected, unlockForPage } from "./builtin-wallet";

import {
  connectWallet as connect,
  disconnectWallet as disconnect,
  getWalletMode,
  NeedWalletError,
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

  const router = useRouter();
  useEffect(() => subscribeWallet(setState), []);

  const connectWallet = useCallback(async () => {
    // Réseau de test : la personne choisit son wallet. Wallet factice
    // (démonstration, tests) : connexion directe.
    const choice = getWalletMode() === "kastle" ? await pickWallet() : undefined;
    if (choice === null) return;
    // Première connexion d'une extension : conseils « compte dédié » d'abord.
    const extension = choice === "kastle" || choice === "kasperia";
    if (needsGuide(extension) && !(await guideBeforeConnect())) return;
    // Wallet intégré protégé : le code (ou l'empreinte) avant de se connecter.
    if (choice === "builtin" && isProtected()) {
      if (!(await unlockForPage())) return;
      grantPagePass();
    }
    setIsLoading(true);
    setError(null);
    try {
      await connect(choice);
    } catch (e) {
      // Pas encore de wallet : page « Mon wallet » pour en créer un.
      if (e instanceof NeedWalletError) {
        void router.navigate({ to: "/wallet" });
        return;
      }
      // Message neutre : aucune adresse ni détail technique affiché.
      const message =
        e instanceof WalletError ? e.message : translate(getLocale(), "wallet.err.generic");
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  return { ...state, isLoading, error, connectWallet, disconnectWallet: disconnect };
}
