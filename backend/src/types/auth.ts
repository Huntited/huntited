// Types de l'autorisation d'accès au chat.

export type ChatRole = "creator" | "participant";

/** Contenu minimal du jeton : jamais l'adresse brute. */
export interface ChatAccessClaims {
  walletFingerprint: string;
  huntId: string;
  role: ChatRole;
}

/** Réponse publique : le jeton et son expiration, rien d'autre. */
export interface PublicAuthResponse {
  accessToken: string;
  expiresAt: number;
}

export type HuntAccessStatus = "active" | "activated" | "expired" | "settled";
export type HuntOutcome = "success" | "failure";
