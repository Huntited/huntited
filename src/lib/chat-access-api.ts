// Jeton d'accès court au chat (backend Huntited), obtenu à partir de la
// session signée du wallet (voir api-client.ts).
// Le jeton reste en mémoire React uniquement (jamais localStorage).
// Aucun log du jeton ni de l'adresse.
import { ApiError, apiFetch, getSessionToken } from "./api-client";

export { apiBaseUrl } from "./api-client";

export interface ChatAccessToken {
  accessToken: string;
  expiresAt: number;
}

export type ChatAccessFailure = "forbidden" | "unavailable" | "not_ready" | "signature_refused";

export class ChatAccessError extends Error {
  constructor(public readonly reason: ChatAccessFailure) {
    super(reason);
  }
}

function toChatError(e: unknown): ChatAccessError {
  if (!(e instanceof ApiError)) return new ChatAccessError("unavailable");
  switch (e.reason) {
    case "signature_refused":
      return new ChatAccessError("signature_refused");
    case "forbidden":
    case "not_found":
      return new ChatAccessError("forbidden");
    case "not_ready":
    case "conflict":
      return new ChatAccessError("not_ready");
    default:
      return new ChatAccessError("unavailable");
  }
}

/**
 * Rôle inscrit par le serveur dans le jeton de chat (le jeton est déjà
 * vérifié côté serveur ; ici on ne fait que lire son contenu pour l'affichage).
 */
export function roleFromChatToken(token: string): "creator" | "participant" | null {
  try {
    const payload = token.split(".")[1] ?? "";
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const role = (JSON.parse(json) as { role?: unknown }).role;
    return role === "creator" || role === "participant" ? role : null;
  } catch {
    return null;
  }
}

/**
 * Session (signature si nécessaire) → jeton de chat pour cette chasse.
 * `sign` est fourni par l'appelant (wallet connecté).
 */
export async function obtainChatAccess(input: {
  huntId: string;
  walletAddress: string;
  sign?: (message: string) => Promise<string>;
}): Promise<ChatAccessToken> {
  try {
    const session = await getSessionToken(input.walletAddress, input.sign);
    return await apiFetch<ChatAccessToken>(
      "POST",
      "/api/auth/chat-access",
      { huntId: input.huntId },
      session,
    );
  } catch (e) {
    throw toChatError(e);
  }
}
