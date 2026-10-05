// ID de requête aléatoire, sans lien avec l'IP ou l'utilisateur.
import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export function requestId(_req: Request, res: Response, next: NextFunction) {
  const id = randomUUID();
  res.locals["requestId"] = id;
  res.setHeader("X-Request-Id", id);
  next();
}
