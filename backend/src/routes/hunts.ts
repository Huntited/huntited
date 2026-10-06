// Registre partagé des chasses :
//   GET  /api/hunts             → liste publique
//   GET  /api/hunts/:id         → une chasse (compteur masqué si demandé)
//   POST /api/hunts             → (session) créer une chasse
//   POST /api/hunts/:id/commit  → (session) s'engager (une fois par wallet)
//   POST /api/hunts/:id/settle  → DEV : résolution simulée (aucun KAS)
// Aucun KAS n'est déplacé : les montants sont calculés côté front (simulation).
import { Router } from "express";
import { z } from "zod";

import { rateLimit } from "../middleware/rate-limit.js";
import { requireSession } from "../middleware/require-session.js";
import type { AuthService } from "../services/auth-service.js";
import { RegistryError, type HuntRegistry } from "../services/hunt-registry.js";

const huntIdSchema = z.string().regex(/^[\w-]{1,64}$/);
const MAX_DEADLINE_MS = 366 * 24 * 3600 * 1000;

/**
 * Seuil minimum d'une chasse : des actions vraiment collectives, et une
 * récompense du créateur plus difficile à récupérer avec ses propres wallets.
 * Même valeur que MIN_THRESHOLD côté front (src/lib/hunt-economics.ts).
 */
export const MIN_HUNT_THRESHOLD = 7;

export function huntsRouter(deps: {
  registry: HuntRegistry;
  auth: AuthService;
  isDevelopment: boolean;
  now?: () => number;
  minThreshold?: number;
  rateLimitMultiplier?: number;
}): Router {
  const { registry, auth } = deps;
  const minThreshold = deps.minThreshold ?? MIN_HUNT_THRESHOLD;
  const now = deps.now ?? Date.now;
  const router = Router();
  const writeLimiter = rateLimit({
    windowMs: 60_000,
    max: 20 * (deps.rateLimitMultiplier ?? 1),
  });

  const createSchema = z.object({
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().min(1).max(2000),
    location: z.string().trim().min(1).max(200),
    deadline: z
      .string()
      .datetime({ offset: true })
      .refine((d) => {
        const t = Date.parse(d);
        return t > now() && t < now() + MAX_DEADLINE_MS;
      }, "Date limite invalide."),
    threshold: z
      .number()
      .int()
      .min(minThreshold, `Le seuil doit être d'au moins ${minThreshold} personnes.`)
      .max(100_000),
    progressVisibility: z.enum(["visible", "hidden"]).default("visible"),
  });

  const sendRegistryError = (res: import("express").Response, e: RegistryError) => {
    const code = {
      not_found: 404,
      closed: 409,
      already_committed: 409,
      not_settleable: 409,
      invalid_threshold: 400,
    }[e.code];
    return res.status(code).json({ error: e.message, code: e.code });
  };

  router.get("/", (_req, res) => {
    res.json(registry.list().map((h) => registry.publicView(h)));
  });

  router.get("/:id", (req, res) => {
    const id = huntIdSchema.safeParse(req.params["id"]);
    const hunt = id.success ? registry.get(id.data) : undefined;
    if (!hunt) return res.status(404).json({ error: "Chasse introuvable." });
    return res.json(registry.publicView(hunt));
  });

  router.post("/", writeLimiter, requireSession(auth), (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      const tooLow = parsed.error.issues.some(
        (i) => i.path[0] === "threshold" && i.code === "too_small",
      );
      return res.status(400).json(
        tooLow
          ? {
              error: `Le seuil doit être d'au moins ${minThreshold} personnes.`,
              code: "threshold_too_low",
            }
          : { error: "Requête invalide." },
      );
    }
    const hunt = registry.create(
      { ...parsed.data, deadline: new Date(parsed.data.deadline).toISOString() },
      req.session!.walletKey,
    );
    return res.status(201).json(registry.publicView(hunt));
  });

  router.post("/:id/commit", writeLimiter, requireSession(auth), (req, res) => {
    const id = huntIdSchema.safeParse(req.params["id"]);
    if (!id.success) return res.status(404).json({ error: "Chasse introuvable." });
    // Seuil personnel facultatif (« je viens si au moins N personnes viennent »).
    const body = z
      .object({ personalThreshold: z.number().int().positive().optional() })
      .safeParse(req.body ?? {});
    if (!body.success) return res.status(400).json({ error: "Requête invalide." });
    try {
      const { rank, hunt } = registry.commit(
        id.data,
        req.session!.walletKey,
        body.data.personalThreshold,
      );
      // Rang masqué pour une chasse à progression masquée encore active :
      // il révélerait le nombre d'engagés.
      return res
        .status(201)
        .json({ rank: registry.visibleRank(hunt, rank), hunt: registry.publicView(hunt) });
    } catch (e) {
      if (e instanceof RegistryError) return sendRegistryError(res, e);
      throw e;
    }
  });

  router.post("/:id/settle", (req, res) => {
    if (!deps.isDevelopment) return res.status(404).json({ error: "Introuvable." });
    const id = huntIdSchema.safeParse(req.params["id"]);
    if (!id.success) return res.status(404).json({ error: "Chasse introuvable." });
    try {
      return res.json(registry.publicView(registry.settle(id.data)));
    } catch (e) {
      if (e instanceof RegistryError) return sendRegistryError(res, e);
      throw e;
    }
  });

  return router;
}
