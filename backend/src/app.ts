// Construction de l'application Express (sans écoute réseau : testable).
// Privacy-first : aucun log de requête (ni IP, ni en-têtes, ni corps).
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";

import { requestId } from "./middleware/request-id.js";
import { authRouter, type WalletSignatureVerifier } from "./routes/auth.js";
import { chatRouter } from "./routes/chat.js";
import { huntsRouter } from "./routes/hunts.js";
import { meRouter } from "./routes/me.js";
import type { AuthService } from "./services/auth-service.js";
import type { ChallengeService } from "./services/challenge-service.js";
import type { ChatService } from "./services/chat-service.js";
import type { HuntRegistry } from "./services/hunt-registry.js";
import type { PassRegistry } from "./services/pass-registry.js";
import type { CreateChatInput } from "./types/chat.js";
import { passesRouter } from "./routes/passes.js";

export interface AppDeps {
  chat: ChatService;
  auth: AuthService;
  registry: HuntRegistry;
  challenges: ChallengeService;
  verifySignature: WalletSignatureVerifier;
  corsOrigin: string | string[];
  nodeEnv: "development" | "test" | "production";
  now?: () => number;
  /** Nombre de proxys de confiance (hébergeur) pour l'IP du visiteur. */
  trustProxy?: number;
  /** Seuil minimum d'une chasse (défaut : MIN_HUNT_THRESHOLD ; abaissé dans les tests unitaires). */
  minThreshold?: number;
  /** Multiplie toutes les limites de fréquence (1 par défaut). */
  rateLimitMultiplier?: number;
  /** Pass Huntited (anti-bots) ; absent = fonctionnalité désactivée. */
  passes?: { registry: PassRegistry; required: boolean; invitesPerMonth: number };
  /** Durée de vie du salon après la date limite (24 h par défaut). */
  chatTtlMs?: number;
}

const DEFAULT_CHAT_TTL_MS = 86_400_000;

export function createApp(d: AppDeps) {
  // Salon d'une chasse : son titre, ouvert jusqu'à 24 h après la date limite.
  const chatTerms = (huntId: string): CreateChatInput | undefined => {
    const hunt = d.registry.get(huntId);
    return hunt
      ? {
          huntId,
          huntName: hunt.title.slice(0, 80),
          expiresAt: Date.parse(hunt.deadline) + (d.chatTtlMs ?? DEFAULT_CHAT_TTL_MS),
        }
      : undefined;
  };

  const app = express();
  app.disable("x-powered-by");
  if (d.trustProxy) app.set("trust proxy", d.trustProxy);
  app.use(requestId);
  app.use(
    cors({
      origin: d.corsOrigin,
      methods: ["GET", "POST"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );
  app.use(express.json({ limit: "16kb" }));

  app.get("/health", (_req, res) => res.json({ status: "ok" }));
  app.use(
    "/api/auth",
    authRouter({
      auth: d.auth,
      access: d.registry,
      challenges: d.challenges,
      verifySignature: d.verifySignature,
      ...(d.rateLimitMultiplier ? { rateLimitMultiplier: d.rateLimitMultiplier } : {}),
    }),
  );
  app.use(
    "/api/hunts",
    huntsRouter({
      registry: d.registry,
      auth: d.auth,
      isDevelopment: d.nodeEnv !== "production",
      ...(d.now ? { now: d.now } : {}),
      ...(d.minThreshold !== undefined ? { minThreshold: d.minThreshold } : {}),
      ...(d.rateLimitMultiplier ? { rateLimitMultiplier: d.rateLimitMultiplier } : {}),
      ...(d.passes ? { passes: { registry: d.passes.registry, required: d.passes.required } } : {}),
      // Le chat s'ouvre tout seul dès que la chasse se déclenche.
      onActivated: (hunt) => {
        d.chat
          .createChat(chatTerms(hunt.id)!)
          .catch(() => console.error("[chat] auto_create_failed"));
      },
    }),
  );
  if (d.passes) {
    app.use(
      "/api/passes",
      passesRouter({
        passes: d.passes.registry,
        required: d.passes.required,
        invitesPerMonth: d.passes.invitesPerMonth,
        ...(d.now ? { now: d.now } : {}),
        ...(d.rateLimitMultiplier ? { rateLimitMultiplier: d.rateLimitMultiplier } : {}),
      }),
    );
  }
  app.use(
    "/api/me",
    meRouter({
      registry: d.registry,
      auth: d.auth,
      ...(d.rateLimitMultiplier ? { rateLimitMultiplier: d.rateLimitMultiplier } : {}),
    }),
  );
  app.use(
    "/api/chats",
    chatRouter(d.chat, d.auth, d.registry, d.nodeEnv !== "production", chatTerms),
  );

  // Erreurs : réponse générique, aucun détail interne ni secret.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const isJson = err instanceof SyntaxError;
    console.error(`[server] ${isJson ? "invalid_json" : "internal_error"}`);
    res
      .status(isJson ? 400 : 500)
      .json({ error: isJson ? "Requête invalide." : "Erreur serveur." });
  });
  return app;
}
