// Routes du chat (protégées par jeton d'accès court).
//   POST /api/chats          → créateur ou engagé·e retenu·e (idempotent ; le
//                              salon est normalement déjà ouvert au déclenchement)
//   GET  /api/chats/:huntId  → créateur ou engagé·e
//   POST /api/chats/cleanup  → DEV uniquement
import { createHash } from "node:crypto";

import { Router, type Request } from "express";
import { z } from "zod";

import { requireChatAccess } from "../middleware/require-chat-access.js";
import type { AuthService } from "../services/auth-service.js";
import { ChatServiceError, type ChatService } from "../services/chat-service.js";
import { isChatAllowed, type HuntAccessStore } from "../services/hunt-access-store.js";
import type { ChatMember, CreateChatInput } from "../types/chat.js";

const huntIdSchema = z.string().regex(/^[\w-]{1,64}$/);

/**
 * Personne qui demande l'accès : clé propre à la chasse et au wallet (le
 * wallet n'est ni transmis à Matrix ni stocké), et son rôle.
 */
function memberOf(req: Request, huntId: string): ChatMember | undefined {
  const access = req.chatAccess;
  if (!access) return undefined;
  const key = createHash("sha256")
    .update(`huntited:chat|${huntId}|${access.walletFingerprint}`)
    .digest("hex");
  return { key, role: access.role };
}
const createSchema = z.object({
  huntId: huntIdSchema,
  huntName: z.string().trim().min(1).max(80),
  expiresAt: z.number().int().positive(),
});

export function chatRouter(
  service: ChatService,
  auth: AuthService,
  access: HuntAccessStore,
  isDevelopment: boolean,
  terms?: (huntId: string) => CreateChatInput | undefined,
): Router {
  const router = Router();
  const stillAllowed = (id: string) =>
    isChatAllowed(access.getHuntStatus(id), access.getHuntOutcome(id));

  router.post("/cleanup", async (_req, res, next) => {
    if (!isDevelopment) return res.status(404).json({ error: "Introuvable." });
    try {
      return res.json({ closed: await service.cleanExpiredChats() });
    } catch (e) {
      return next(e);
    }
  });

  router.post(
    "/",
    requireChatAccess(auth, (req) => (req.body as { huntId?: unknown } | undefined)?.huntId),
    async (req, res, next) => {
      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Requête invalide." });
      if (!stillAllowed(parsed.data.huntId)) {
        return res.status(409).json({ error: "Le chat n'est pas disponible pour cette chasse." });
      }
      try {
        // Le salon s'ouvre normalement tout seul au déclenchement ; sinon (Matrix
        // indisponible à ce moment-là), toute personne autorisée peut le rouvrir.
        // Nom et expiration viennent du registre quand il connaît la chasse.
        const input = terms?.(parsed.data.huntId) ?? parsed.data;
        return res
          .status(201)
          .json(await service.createChat(input, memberOf(req, parsed.data.huntId)));
      } catch (e) {
        if (e instanceof ChatServiceError) {
          return res.status(e.code === "invalid" ? 400 : 409).json({ error: e.message });
        }
        return next(e);
      }
    },
  );

  router.get(
    "/:huntId",
    requireChatAccess(auth, (req) => req.params["huntId"]),
    async (req, res, next) => {
      const parsed = huntIdSchema.safeParse(req.params["huntId"]);
      if (!parsed.success) return res.status(400).json({ error: "Requête invalide." });
      if (!stillAllowed(parsed.data)) return res.status(404).json({ isActive: false });
      try {
        const status = await service.getChatStatus(parsed.data, memberOf(req, parsed.data));
        return res.status(status.isActive ? 200 : 404).json(status);
      } catch (e) {
        return next(e);
      }
    },
  );

  return router;
}
