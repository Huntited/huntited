// Routes du chat (protégées par jeton d'accès court).
//   POST /api/chats          → créateur uniquement (idempotent)
//   GET  /api/chats/:huntId  → créateur ou engagé·e
//   POST /api/chats/cleanup  → DEV uniquement
import { Router } from "express";
import { z } from "zod";

import { requireChatAccess } from "../middleware/require-chat-access.js";
import type { AuthService } from "../services/auth-service.js";
import { ChatServiceError, type ChatService } from "../services/chat-service.js";
import { isChatAllowed, type HuntAccessStore } from "../services/hunt-access-store.js";

const huntIdSchema = z.string().regex(/^[\w-]{1,64}$/);
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
        // Un·e engagé·e peut récupérer un salon existant, jamais en créer un.
        if (req.chatAccess?.role !== "creator") {
          const existing = await service.getChatStatus(parsed.data.huntId);
          if (existing.isActive) return res.json(existing);
          return res
            .status(403)
            .json({ error: "Seul·e le créateur ou la créatrice peut ouvrir le chat." });
        }
        return res.status(201).json(await service.createChat(parsed.data));
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
        const status = await service.getChatStatus(parsed.data);
        return res.status(status.isActive ? 200 : 404).json(status);
      } catch (e) {
        return next(e);
      }
    },
  );

  return router;
}
