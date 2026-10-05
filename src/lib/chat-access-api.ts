// Demande d'un jeton d'accès court au chat (backend Huntited).
// Le jeton reste en mémoire React uniquement (jamais localStorage).
// Aucun log du jeton ni de l'adresse.
//
// MOCK MVP : l'adresse est déclarée. En production → signature Kaspa d'un challenge.

export interface ChatAccessToken {
  accessToken: string;
  expiresAt: number;
}

export type ChatAccessFailure = "forbidden" | "unavailable" | "not_ready";

export class ChatAccessError extends Error {
  constructor(public readonly reason: ChatAccessFailure) {
    super(reason);
  }
}

export function apiBaseUrl(): string {
  return (import.meta.env["VITE_API_BASE_URL"] as string | undefined) ?? "http://localhost:3001";
}

export async function requestChatAccess(input: {
  huntId: string;
  walletAddress: string;
}): Promise<ChatAccessToken> {
  let res: Response;
  try {
    res = await fetch(`${apiBaseUrl()}/api/auth/chat-access`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    throw new ChatAccessError("unavailable");
  }
  if (res.status === 401 || res.status === 404) throw new ChatAccessError("forbidden");
  if (res.status === 409) throw new ChatAccessError("not_ready");
  if (!res.ok) throw new ChatAccessError("unavailable");
  return (await res.json()) as ChatAccessToken;
}

/**
 * DEV uniquement : recopie l'état mocké local (statut, rôle) vers le backend,
 * qui n'a pas encore d'accès à l'état on-chain.
 */
export async function devSeedHuntAccess(input: {
  huntId: string;
  status: "active" | "activated" | "expired" | "settled";
  outcome?: "success" | "failure";
  walletAddress?: string;
  role?: "creator" | "participant";
}): Promise<void> {
  if (!import.meta.env.DEV) return;
  try {
    await fetch(`${apiBaseUrl()}/api/auth/dev/seed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    /* backend absent : la demande de jeton échouera proprement */
  }
}
