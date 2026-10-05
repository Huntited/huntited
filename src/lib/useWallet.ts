import { useCallback, useEffect, useState } from "react";
import {
  connectWallet as connect,
  disconnectWallet as disconnect,
  subscribeWallet,
  type WalletState,
} from "./wallet";

export interface UseWalletResult {
  isConnected: boolean;
  address: string | null;
  isLoading: boolean;
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

  useEffect(() => subscribeWallet(setState), []);

  const connectWallet = useCallback(async () => {
    setIsLoading(true);
    try {
      await connect();
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { ...state, isLoading, connectWallet, disconnectWallet: disconnect };
}
