// Notifications « me prévenir » (Web Push), sans compte ni wallet :
//   GET  /api/push/key          → { publicKey } (clé VAPID publique)
//   POST /api/push/subscribe    → { huntId, subscription, locale }
//   POST /api/push/unsubscribe  → { huntId, endpoint }
// Voir services/push-service.ts pour ce qui est conservé (et combien de temps).
import { Router } from "express";
import { z } from "zod";

import { rateLimit } from "../middleware/rate-limit.js";
import type { HuntRegistry } from "../services/hunt-registry.js";
import type { PushService } from "../services/push-service.js";

/**
 * Services de push des navigateurs. Le serveur envoie des requêtes à
 * l'adresse fournie par le navigateur : on n'accepte que ces services, pour
 * qu'elle ne puisse pas viser une autre machine.
 */
const PUSH_HOSTS = [
  "fcm.googleapis.com",
  "push.services.mozilla.com",
  "push.apple.com",
  "notify.windows.com",
];

export function isPushEndpoint(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.protocol === "https:" &&
      u.port === "" &&
      PUSH_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`))
    );
  } catch {
    return false;
  }
}

const huntIdSchema = z.string().regex(/^[\w-]{1,64}$/);
const endpointSchema = z.string().max(1024).refine(isPushEndpoint);
const base64url = (max: number) =>
  z
    .string()
    .regex(/^[\w-]+=*$/)
    .max(max);

const subscribeSchema = z.object({
  huntId: huntIdSchema,
  subscription: z.object({
    endpoint: endpointSchema,
    keys: z.object({ p256dh: base64url(200), auth: base64url(100) }),
  }),
  locale: z.enum(["fr", "en"]).default("fr"),
});

export function pushRouter(deps: {
  push: PushService;
  registry: HuntRegistry;
  publicKey: string;
  rateLimitMultiplier?: number;
}): Router {
  const router = Router();
  const limiter = rateLimit({ windowMs: 60_000, max: 20 * (deps.rateLimitMultiplier ?? 1) });

  router.get("/key", (_req, res) => res.json({ publicKey: deps.publicKey }));

  router.post("/subscribe", limiter, (req, res) => {
    const parsed = subscribeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Requête invalide." });
    const { huntId, subscription, locale } = parsed.data;
    const hunt = deps.registry.get(huntId);
    if (!hunt) return res.status(404).json({ error: "Chasse introuvable." });
    // Rien à annoncer pour une chasse déjà déclenchée ou terminée.
    if (deps.registry.status(hunt) !== "active") {
      return res.status(409).json({ error: "Cette chasse est déjà terminée ou déclenchée." });
    }
    if (!deps.push.subscribe(huntId, subscription, locale)) {
      return res.status(429).json({ error: "Trop d'abonnements pour cette chasse." });
    }
    return res.status(201).json({ ok: true });
  });

  router.post("/unsubscribe", limiter, (req, res) => {
    const parsed = z
      .object({ huntId: huntIdSchema, endpoint: z.string().max(1024) })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Requête invalide." });
    deps.push.unsubscribe(parsed.data.huntId, parsed.data.endpoint);
    return res.status(204).end();
  });

  return router;
}
