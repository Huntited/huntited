// POST /api/auth/chat-access : délivre un jeton court d'accès au chat.
// MOCK : l'adresse est déclarée ; en production → signature Kaspa d'un challenge.
// + routes DEV de seed (désactivées en production).
import { Router } from "express";
import { z } from "zod";

import { fingerprintWallet, type AuthService } from "../services/auth-service.js";
import { isChatAllowed, type MockHuntAccessStore } from "../services/hunt-access-store.js";

const huntId = z.string().regex(/^[\w-]{1,64}$/);
const walletAddress = z.string().min(8).max(128);

export function authRouter(auth: AuthService, store: MockHuntAccessStore, isProduction: boolean): Router {
  const router = Router();

  router.post("/chat-access", (req, res) => {
    const parsed = z.object({ huntId, walletAddress }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Requête invalide." });

    const status = store.getHuntStatus(parsed.data.huntId);
    if (!status) return res.status(404).json({ error: "Chasse introuvable." });
    if (!isChatAllowed(status, store.getHuntOutcome(parsed.data.huntId))) {
      return res.status(409).json({ error: "Le chat n'est pas disponible pour cette chasse." });
    }
    const fp = fingerprintWallet(parsed.data.walletAddress);
    const role = store.getWalletRole(parsed.data.huntId, fp);
    if (!role) return res.status(401).json({ error: "Non autorisé." });

    return res.json(auth.issueChatAccessToken({ walletFingerprint: fp, huntId: parsed.data.huntId, role }));
  });

  // --- DEV uniquement : synchronise l'état mocké du front vers le backend ---
  router.post("/dev/seed", (req, res) => {
    if (isProduction) return res.status(404).json({ error: "Introuvable." });
    const parsed = z
      .object({
        huntId,
        status: z.enum(["active", "activated", "expired", "settled"]),
        outcome: z.enum(["success", "failure"]).optional(),
        walletAddress: walletAddress.optional(),
        role: z.enum(["creator", "participant"]).optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Requête invalide." });
    const d = parsed.data;
    store.seedHunt(d.outcome ? { huntId: d.huntId, status: d.status, outcome: d.outcome } : { huntId: d.huntId, status: d.status });
    if (d.walletAddress && d.role) {
      store.seedRole({ huntId: d.huntId, walletFingerprint: fingerprintWallet(d.walletAddress), role: d.role });
    }
    return res.status(204).end();
  });

  return router;
}
