// Authentification par défi signé, puis session courte :
//   POST /api/auth/challenge   → message à signer (usage unique, 5 min)
//   POST /api/auth/session     → vérifie la signature, délivre un jeton de session
//   POST /api/auth/chat-access → (session) jeton d'accès au chat d'une chasse
// L'adresse n'est jamais « déclarée » : elle est prouvée par la signature,
// puis seule son empreinte circule dans les jetons.
import { Router } from "express";
import { z } from "zod";

import { rateLimit } from "../middleware/rate-limit.js";
import { requireSession } from "../middleware/require-session.js";
import { fingerprintWallet, type AuthService } from "../services/auth-service.js";
import type { ChallengeService } from "../services/challenge-service.js";
import { isChatAllowed, type HuntAccessStore } from "../services/hunt-access-store.js";

const huntId = z.string().regex(/^[\w-]{1,64}$/);
const walletAddress = z.string().min(8).max(128);

/** Vérifie que `signature` signe `message` avec la clé de `walletAddress`. */
export type WalletSignatureVerifier = (input: {
  message: string;
  signature: string;
  walletAddress: string;
}) => boolean;

export interface AuthRouterDeps {
  auth: AuthService;
  access: HuntAccessStore;
  challenges: ChallengeService;
  verifySignature: WalletSignatureVerifier;
}

export function authRouter(d: AuthRouterDeps): Router {
  const router = Router();
  const limiter = rateLimit({ windowMs: 60_000, max: 30 });

  router.post("/challenge", limiter, (req, res) => {
    const parsed = z.object({ walletAddress }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Requête invalide." });
    const c = d.challenges.issue(parsed.data);
    return res.json({ challengeId: c.challengeId, message: c.message, expiresAt: c.expiresAt });
  });

  router.post("/session", limiter, (req, res) => {
    const parsed = z
      .object({
        walletAddress,
        challengeId: z.string().regex(/^[0-9a-f]{32}$/),
        signature: z.string().min(1).max(256),
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Requête invalide." });
    const { walletAddress: address, challengeId, signature } = parsed.data;

    // Usage unique : le défi est consommé avant toute vérification.
    const challenge = d.challenges.consume({ challengeId, walletAddress: address });
    if (
      !challenge ||
      !d.verifySignature({ message: challenge.message, signature, walletAddress: address })
    ) {
      return res.status(401).json({ error: "Non autorisé." });
    }
    return res.json(d.auth.issueSessionToken({ walletKey: fingerprintWallet(address) }));
  });

  router.post("/chat-access", limiter, requireSession(d.auth), (req, res) => {
    const parsed = z.object({ huntId }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Requête invalide." });
    const id = parsed.data.huntId;

    const status = d.access.getHuntStatus(id);
    if (!status) return res.status(404).json({ error: "Chasse introuvable." });
    if (!isChatAllowed(status, d.access.getHuntOutcome(id))) {
      return res.status(409).json({ error: "Le chat n'est pas disponible pour cette chasse." });
    }
    const walletKey = req.session!.walletKey;
    const role = d.access.getWalletRole(id, walletKey);
    if (!role) return res.status(401).json({ error: "Non autorisé." });

    return res.json(
      d.auth.issueChatAccessToken({ walletFingerprint: walletKey, huntId: id, role }),
    );
  });

  return router;
}
