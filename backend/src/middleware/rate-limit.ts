// Limite de fréquence simple (fenêtre fixe, mémoire). Clé = empreinte de l'IP :
// l'adresse IP brute n'est ni conservée ni loguée.
import { createHash } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export function rateLimit(opts: { windowMs: number; max: number; now?: () => number }) {
  const now = opts.now ?? Date.now;
  const hits = new Map<string, { count: number; resetAt: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const t = now();
    if (hits.size > 10_000) {
      for (const [k, v] of hits) if (v.resetAt <= t) hits.delete(k);
    }
    const key = createHash("sha256")
      .update(req.ip ?? "unknown")
      .digest("hex")
      .slice(0, 32);
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= t) {
      hits.set(key, { count: 1, resetAt: t + opts.windowMs });
      return next();
    }
    entry.count += 1;
    if (entry.count > opts.max) {
      res.setHeader("Retry-After", String(Math.ceil((entry.resetAt - t) / 1000)));
      return res.status(429).json({ error: "Trop de requêtes. Réessaie plus tard." });
    }
    return next();
  };
}
