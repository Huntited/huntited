// Exige un jeton de session (Bearer) : prouve la possession d'un wallet.
// Erreur 401 générique, sans aucun détail.
import type { NextFunction, Request, Response } from "express";

import type { AuthService, SessionClaims } from "../services/auth-service.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      session?: SessionClaims;
    }
  }
}

export function requireSession(auth: AuthService) {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    try {
      req.session = auth.verifySessionToken(token);
      next();
    } catch {
      res.status(401).json({ error: "Non autorisé." });
    }
  };
}
