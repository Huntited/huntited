// Client HTTP du backend Huntited + session signée.
// La session (jeton court) prouve la possession du wallet : une signature
// par visite, gardée en mémoire uniquement (jamais localStorage), oubliée à
// la déconnexion du wallet. Aucun log : ni adresse, ni message, ni jeton.
import { signMessage, subscribeWallet } from "./wallet";

export type ApiFailure =
  | "forbidden"
  | "unavailable"
  | "not_ready"
  | "signature_refused"
  | "not_found"
  | "conflict"
  | "invalid";

export class ApiError extends Error {
  constructor(
    public readonly reason: ApiFailure,
    /** Code métier renvoyé par le serveur (ex. "already_committed"). */
    public readonly code?: string,
    message?: string,
  ) {
    super(message ?? reason);
  }
}

export function apiBaseUrl(): string {
  return (import.meta.env["VITE_API_BASE_URL"] as string | undefined) ?? "http://localhost:3001";
}

export async function apiFetch<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  token?: string,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${apiBaseUrl()}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new ApiError("unavailable");
  }
  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    /* corps vide ou non JSON */
  }
  const code = typeof data["code"] === "string" ? data["code"] : undefined;
  const message = typeof data["error"] === "string" ? data["error"] : undefined;
  if (res.status === 400) throw new ApiError("invalid", code, message);
  if (res.status === 401 || res.status === 403) throw new ApiError("forbidden", code, message);
  if (res.status === 404) throw new ApiError("not_found", code, message);
  if (res.status === 409) {
    throw new ApiError(code ? "conflict" : "not_ready", code, message);
  }
  if (!res.ok) throw new ApiError("unavailable", code, message);
  return data as T;
}

// --- Session signée -----------------------------------------------------------

interface Session {
  address: string;
  token: string;
  expiresAt: number;
}

let session: Session | null = null;
let pending: Promise<string> | null = null;
let watching = false;

/** Oublie la session (déconnexion, changement de wallet). */
export function clearSession(): void {
  session = null;
  pending = null;
}

function watchWallet() {
  if (watching || typeof window === "undefined") return;
  watching = true;
  subscribeWallet((s) => {
    if (!s.isConnected || (session && s.address !== session.address)) clearSession();
  });
}

/**
 * Jeton de session pour `address` : réutilise la session en mémoire, sinon
 * fait signer un défi du serveur par le wallet (une seule demande à la fois).
 */
export async function getSessionToken(
  address: string,
  sign: (message: string) => Promise<string> = signMessage,
): Promise<string> {
  watchWallet();
  if (session && session.address === address && session.expiresAt - 30_000 > Date.now()) {
    return session.token;
  }
  if (pending) return pending;
  pending = (async () => {
    const challenge = await apiFetch<{ challengeId: string; message: string }>(
      "POST",
      "/api/auth/challenge",
      { walletAddress: address },
    );
    let signature: string;
    try {
      signature = await sign(challenge.message);
    } catch {
      throw new ApiError("signature_refused");
    }
    const s = await apiFetch<{ accessToken: string; expiresAt: number }>(
      "POST",
      "/api/auth/session",
      { walletAddress: address, challengeId: challenge.challengeId, signature },
    );
    session = { address, token: s.accessToken, expiresAt: s.expiresAt };
    return s.accessToken;
  })();
  try {
    return await pending;
  } finally {
    pending = null;
  }
}
