// Accès au chat par défi signé :
//   POST /api/auth/challenge   → message à signer (usage unique, 5 min)
//   POST /api/auth/chat-access → vérifie la signature, délivre un jeton court
// + routes DEV de seed (désactivées en production).
// L'adresse n'est plus « déclarée » : elle est prouvée par la signature.
import { Router } from "express";
import { z } from "zod";

import { rateLimit } from "../middleware/rate-limit.js";
import { fingerprintWallet, type AuthService } from "../services/auth-service.js";
import type { ChallengeService } from "../services/challenge-service.js";
import { isChatAllowed, type MockHuntAccessStore } from "../services/hunt-access-store.js";

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
  store: MockHuntAccessStore;
  challenges: ChallengeService;
  verifySignature: WalletSignatureVerifier;
  isProduction: boolean;
}

export function authRouter(d: AuthRouterDeps): Router {
  const router = Router();
  const limiter = rateLimit({ windowMs: 60_000, max: 30 });

  /** 404 si la chasse est inconnue, 409 si le chat n'est pas encore ouvert. */
  const chatGate = (id: string): { code: number; error: string } | undefined => {
    const status = d.store.getHuntStatus(id);
    if (!status) return { code: 404, error: "Chasse introuvable." };
    if (!isChatAllowed(status, d.store.getHuntOutcome(id))) {
      return { code: 409, error: "Le chat n'est pas disponible pour cette chasse." };
    }
    return undefined;
  };

  router.post("/challenge", limiter, (req, res) => {
    const parsed = z.object({ huntId, walletAddress }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Requête invalide." });
    const gate = chatGate(parsed.data.huntId);
    if (gate) return res.status(gate.code).json({ error: gate.error });

    const c = d.challenges.issue(parsed.data);
    return res.json({ challengeId: c.challengeId, message: c.message, expiresAt: c.expiresAt });
  });

  router.post("/chat-access", limiter, (req, res) => {
    const parsed = z
      .object({
        huntId,
        walletAddress,
        challengeId: z.string().regex(/^[0-9a-f]{32}$/),
        signature: z.string().min(1).max(256),
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Requête invalide." });
    const { huntId: id, walletAddress: address, challengeId, signature } = parsed.data;

    const gate = chatGate(id);
    if (gate) return res.status(gate.code).json({ error: gate.error });

    // Usage unique : le défi est consommé avant toute vérification.
    const challenge = d.challenges.consume({ challengeId, walletAddress: address, huntId: id });
    if (
      !challenge ||
      !d.verifySignature({ message: challenge.message, signature, walletAddress: address })
    ) {
      return res.status(401).json({ error: "Non autorisé." });
    }

    const fp = fingerprintWallet(address);
    const role = d.store.getWalletRole(id, fp);
    if (!role) return res.status(401).json({ error: "Non autorisé." });

    return res.json(d.auth.issueChatAccessToken({ walletFingerprint: fp, huntId: id, role }));
  });

  // --- DEV uniquement : synchronise l'état mocké du front vers le backend ---
  router.post("/dev/seed", (req, res) => {
    if (d.isProduction) return res.status(404).json({ error: "Introuvable." });
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
    const p = parsed.data;
    d.store.seedHunt(
      p.outcome
        ? { huntId: p.huntId, status: p.status, outcome: p.outcome }
        : { huntId: p.huntId, status: p.status },
    );
    if (p.walletAddress && p.role) {
      d.store.seedRole({
        huntId: p.huntId,
        walletFingerprint: fingerprintWallet(p.walletAddress),
        role: p.role,
      });
    }
    return res.status(204).end();
  });

  return router;
}
