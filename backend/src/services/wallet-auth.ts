// Choix du vérificateur de signature selon WALLET_AUTH_MODE :
//   "signature" → vraie vérification Kaspa (Schnorr, préfixe du réseau)
//   "mock"      → accepte les signatures factices du wallet mock du front
//                 (développement uniquement ; refusé en production par env.ts)
import type { WalletSignatureVerifier } from "../routes/auth.js";
import { verifyKaspaMessage } from "./kaspa-signature.js";

/** Préfixe d'adresse des réseaux acceptés. Seul le testnet l'est pour l'instant. */
const ADDRESS_PREFIX: Record<"testnet-10", string> = { "testnet-10": "kaspatest" };

export function createSignatureVerifier(
  mode: "signature" | "mock",
  network: "testnet-10",
): WalletSignatureVerifier {
  if (mode === "mock") {
    return ({ signature }) => /^mocksig_[0-9a-f]{64}$/.test(signature);
  }
  const expectedPrefix = ADDRESS_PREFIX[network];
  return ({ message, signature, walletAddress }) =>
    verifyKaspaMessage({
      message,
      signatureHex: signature,
      address: walletAddress,
      expectedPrefix,
    });
}
