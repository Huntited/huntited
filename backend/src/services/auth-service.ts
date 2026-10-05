// Jetons d'accès courts au chat (JWT HS256).
// MOCK MVP : l'adresse est simplement déclarée par le client. En production,
// elle sera prouvée par la signature Kaspa d'un challenge unique.
// Aucun log de jeton ni d'adresse.
import { createHash } from "node:crypto";
import jwt from "jsonwebtoken";

import type { ChatAccessClaims, ChatRole, PublicAuthResponse } from "../types/auth.js";

export class AuthError extends Error {
  constructor() {
    super("Non autorisé.");
  }
}

/** Empreinte SHA-256 tronquée (32 hex). L'adresse n'est jamais conservée. */
export function fingerprintWallet(walletAddress: string): string {
  return createHash("sha256").update(`huntited:chat|${walletAddress}`).digest("hex").slice(0, 32);
}

const ROLES: readonly ChatRole[] = ["creator", "participant"];

export class AuthService {
  constructor(
    private readonly secret: string,
    private readonly ttlSeconds: number,
    private readonly now: () => number = Date.now,
  ) {}

  issueChatAccessToken(claims: ChatAccessClaims): PublicAuthResponse {
    const iat = Math.floor(this.now() / 1000);
    const exp = iat + this.ttlSeconds;
    const accessToken = jwt.sign(
      { fp: claims.walletFingerprint, hid: claims.huntId, role: claims.role, iat, exp },
      this.secret,
      { algorithm: "HS256" },
    );
    return { accessToken, expiresAt: exp * 1000 };
  }

  verifyChatAccessToken(token: string): ChatAccessClaims {
    try {
      const p = jwt.verify(token, this.secret, {
        algorithms: ["HS256"],
        clockTimestamp: Math.floor(this.now() / 1000),
      });
      if (typeof p !== "object" || p === null) throw new AuthError();
      const { fp, hid, role } = p as Record<string, unknown>;
      if (typeof fp !== "string" || typeof hid !== "string" || !ROLES.includes(role as ChatRole)) {
        throw new AuthError();
      }
      return { walletFingerprint: fp, huntId: hid, role: role as ChatRole };
    } catch {
      throw new AuthError(); // erreur générique, sans détail
    }
  }
}
