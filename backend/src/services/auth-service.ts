// Jetons courts (JWT HS256) :
//   - session : délivré après vérification de la signature d'un défi unique
//     (routes/auth.ts) ; prouve la possession d'un wallet ;
//   - chat : accès au chat d'une chasse, délivré à partir d'une session.
// Le champ `typ` empêche d'utiliser l'un à la place de l'autre.
// Aucun log de jeton ni d'adresse.
import { createHash } from "node:crypto";
import jwt from "jsonwebtoken";

import type { ChatAccessClaims, ChatRole, PublicAuthResponse } from "../types/auth.js";

export class AuthError extends Error {
  constructor() {
    super("Non autorisé.");
  }
}

/** Empreinte SHA-256 tronquée (32 hex) du wallet. L'adresse n'est jamais conservée. */
export function fingerprintWallet(walletAddress: string): string {
  return createHash("sha256").update(`huntited:chat|${walletAddress}`).digest("hex").slice(0, 32);
}

const ROLES: readonly ChatRole[] = ["creator", "participant"];

export interface SessionClaims {
  /** Empreinte du wallet (fingerprintWallet). */
  walletKey: string;
}

export class AuthService {
  constructor(
    private readonly secret: string,
    private readonly ttlSeconds: number,
    private readonly now: () => number = Date.now,
    private readonly sessionTtlSeconds: number = 3600,
  ) {}

  private sign(payload: Record<string, unknown>, ttl: number): PublicAuthResponse {
    const iat = Math.floor(this.now() / 1000);
    const exp = iat + ttl;
    const accessToken = jwt.sign({ ...payload, iat, exp }, this.secret, { algorithm: "HS256" });
    return { accessToken, expiresAt: exp * 1000 };
  }

  private verify(token: string, typ: "chat" | "session"): Record<string, unknown> {
    try {
      const p = jwt.verify(token, this.secret, {
        algorithms: ["HS256"],
        clockTimestamp: Math.floor(this.now() / 1000),
      });
      if (typeof p !== "object" || p === null) throw new AuthError();
      const claims = p as Record<string, unknown>;
      if (claims["typ"] !== typ) throw new AuthError();
      return claims;
    } catch {
      throw new AuthError(); // erreur générique, sans détail
    }
  }

  issueSessionToken(claims: SessionClaims): PublicAuthResponse {
    return this.sign({ typ: "session", wk: claims.walletKey }, this.sessionTtlSeconds);
  }

  verifySessionToken(token: string): SessionClaims {
    const { wk } = this.verify(token, "session");
    if (typeof wk !== "string") throw new AuthError();
    return { walletKey: wk };
  }

  issueChatAccessToken(claims: ChatAccessClaims): PublicAuthResponse {
    return this.sign(
      { typ: "chat", fp: claims.walletFingerprint, hid: claims.huntId, role: claims.role },
      this.ttlSeconds,
    );
  }

  verifyChatAccessToken(token: string): ChatAccessClaims {
    const { fp, hid, role } = this.verify(token, "chat");
    if (typeof fp !== "string" || typeof hid !== "string" || !ROLES.includes(role as ChatRole)) {
      throw new AuthError();
    }
    return { walletFingerprint: fp, huntId: hid, role: role as ChatRole };
  }
}
