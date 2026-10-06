// Pass Huntited (une personne vérifiée = un pass), sans compte ni donnée
// personnelle — voir docs/anti-bots.md.
//   GET  /api/passes/config       → { required, invitesPerMonth }
//   GET  /api/passes/group        → empreintes des pass (pour calculer une preuve)
//   POST /api/passes/redeem       → { invitation, commitment } : rejoindre le groupe
//   POST /api/passes/invitations  → { slot, proof } : un membre crée une invitation
//                                   (preuve anonyme : on ne sait pas quel membre)
import { Router } from "express";
import { z } from "zod";

import { rateLimit } from "../middleware/rate-limit.js";
import { PassError, type PassRegistry } from "../services/pass-registry.js";
import { checkProof, inviteScope, proofSchema } from "../services/semaphore.js";

const commitmentSchema = z.string().regex(/^\d{1,80}$/);
const invitationSchema = z.string().regex(/^[\w-]{16,128}$/);

export function passesRouter(deps: {
  passes: PassRegistry;
  required: boolean;
  invitesPerMonth: number;
  now?: () => number;
  rateLimitMultiplier?: number;
}): Router {
  const { passes } = deps;
  const now = deps.now ?? Date.now;
  const router = Router();
  const limiter = rateLimit({ windowMs: 60_000, max: 20 * (deps.rateLimitMultiplier ?? 1) });

  const sendPassError = (res: import("express").Response, e: PassError) =>
    res
      .status(e.code === "invalid_invitation" ? 400 : 409)
      .json({ error: e.message, code: e.code });

  router.get("/config", (_req, res) =>
    res.json({ required: deps.required, invitesPerMonth: deps.invitesPerMonth }),
  );

  router.get("/group", (_req, res) => res.json({ members: passes.members() }));

  router.post("/redeem", limiter, (req, res) => {
    const body = z
      .object({ invitation: invitationSchema, commitment: commitmentSchema })
      .safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "Requête invalide." });
    try {
      passes.redeem(body.data.invitation, body.data.commitment);
      return res.status(201).json({ ok: true });
    } catch (e) {
      if (e instanceof PassError) return sendPassError(res, e);
      throw e;
    }
  });

  router.post("/invitations", limiter, async (req, res, next) => {
    try {
      const body = z
        .object({
          slot: z.number().int().min(1).max(deps.invitesPerMonth),
          proof: proofSchema,
        })
        .safeParse(req.body);
      if (!body.success) return res.status(400).json({ error: "Requête invalide." });
      const scope = inviteScope(now(), body.data.slot);
      const ok = await checkProof(body.data.proof, {
        scope,
        message: 0,
        roots: passes.knownRoots(),
      });
      if (!ok) {
        return res.status(403).json({ error: "Preuve de pass invalide.", code: "invalid_proof" });
      }
      passes.useSlot(scope, body.data.proof.nullifier);
      return res.status(201).json(passes.createInvitation());
    } catch (e) {
      if (e instanceof PassError) return sendPassError(res, e);
      return next(e);
    }
  });

  return router;
}
