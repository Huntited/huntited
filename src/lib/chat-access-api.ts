// Demande d'un jeton d'accès court au chat (backend Huntited), en deux temps :
//   1. requestChallenge : le serveur rédige un message à usage unique ;
//   2. requestChatAccess : le wallet l'a signé, le serveur vérifie la signature.
// Le jeton reste en mémoire React uniquement (jamais localStorage).
// Aucun log du jeton, de l'adresse, du message ni de la signature.

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

export function apiBaseUrl(): string {
  return (import.meta.env["VITE_API_BASE_URL"] as string | undefined) ?? "http://localhost:3001";
}

export interface ChatChallenge {
  challengeId: string;
  /** Message exact à faire signer par le wallet. */
  message: string;
  expiresAt: number;
}

async function postAuth<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${apiBaseUrl()}/api/auth/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ChatAccessError("unavailable");
  }
  if (res.status === 401 || res.status === 404) throw new ChatAccessError("forbidden");
  if (res.status === 409) throw new ChatAccessError("not_ready");
  if (!res.ok) throw new ChatAccessError("unavailable");
  return (await res.json()) as T;
}

export function requestChallenge(input: {
  huntId: string;
  walletAddress: string;
}): Promise<ChatChallenge> {
  return postAuth<ChatChallenge>("challenge", input);
}

export function requestChatAccess(input: {
  huntId: string;
  walletAddress: string;
  challengeId: string;
  signature: string;
}): Promise<ChatAccessToken> {
  return postAuth<ChatAccessToken>("chat-access", input);
}

/**
 * Parcours complet : défi → signature par le wallet → jeton.
 * `sign` est fourni par l'appelant (wallet connecté).
 */
export async function obtainChatAccess(input: {
  huntId: string;
  walletAddress: string;
  sign: (message: string) => Promise<string>;
}): Promise<ChatAccessToken> {
  const challenge = await requestChallenge({
    huntId: input.huntId,
    walletAddress: input.walletAddress,
  });
  let signature: string;
  try {
    signature = await input.sign(challenge.message);
  } catch {
    throw new ChatAccessError("signature_refused");
  }
  return requestChatAccess({
    huntId: input.huntId,
    walletAddress: input.walletAddress,
    challengeId: challenge.challengeId,
    signature,
  });
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
