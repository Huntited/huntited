// Vérifie le jeton Bearer et qu'il vise bien la chasse demandée.
// Erreur 401 générique, sans aucun détail.
import type { NextFunction, Request, Response } from "express";

import type { AuthService } from "../services/auth-service.js";
import type { ChatAccessClaims } from "../types/auth.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      chatAccess?: ChatAccessClaims;
    }
  }
}

export function requireChatAccess(auth: AuthService, getHuntId: (req: Request) => unknown) {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    try {
      const claims = auth.verifyChatAccessToken(token);
      if (claims.huntId !== getHuntId(req)) throw new Error();
      req.chatAccess = claims;
      next();
    } catch {
      res.status(401).json({ error: "Non autorisé." });
    }
  };
}
