// Activité du wallet connecté (session signée requise) :
//   GET /api/me → chasses créées + engagements (rang révélé si autorisé)
// Permet de retrouver « Mes chasses » et les badges sur un autre appareil.
// Seul le wallet authentifié voit sa propre activité.
import { Router } from "express";

import { rateLimit } from "../middleware/rate-limit.js";
import { requireSession } from "../middleware/require-session.js";
import type { AuthService } from "../services/auth-service.js";
import type { HuntRegistry } from "../services/hunt-registry.js";

export function meRouter(deps: {
  registry: HuntRegistry;
  auth: AuthService;
  rateLimitMultiplier?: number;
}): Router {
  const { registry, auth } = deps;
  const router = Router();

  router.get(
    "/",
    rateLimit({ windowMs: 60_000, max: 30 * (deps.rateLimitMultiplier ?? 1) }),
    requireSession(auth),
    (req, res) => {
      const { created, commitments } = registry.activityFor(req.session!.walletKey);
      res.json({
        created: created.map((h) => registry.publicView(h)),
        commitments: commitments.map((c) => ({
          hunt: registry.publicView(c.hunt),
          rank: registry.visibleRank(c.hunt, c.rank),
          committedAt: c.committedAt,
          personalThreshold: c.personalThreshold,
          retained: c.retained,
        })),
      });
    },
  );

  return router;
}
