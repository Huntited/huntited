// Construction de l'application Express (sans écoute réseau : testable).
// Privacy-first : aucun log de requête (ni IP, ni en-têtes, ni corps).
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";

import { requestId } from "./middleware/request-id.js";
import { authRouter, type WalletSignatureVerifier } from "./routes/auth.js";
import { chatRouter } from "./routes/chat.js";
import { huntsRouter } from "./routes/hunts.js";
import type { AuthService } from "./services/auth-service.js";
import type { ChallengeService } from "./services/challenge-service.js";
import type { ChatService } from "./services/chat-service.js";
import type { HuntRegistry } from "./services/hunt-registry.js";

export interface AppDeps {
  chat: ChatService;
  auth: AuthService;
  registry: HuntRegistry;
  challenges: ChallengeService;
  verifySignature: WalletSignatureVerifier;
  corsOrigin: string | string[];
  nodeEnv: "development" | "test" | "production";
  now?: () => number;
}

export function createApp(d: AppDeps) {
  const app = express();
  app.disable("x-powered-by");
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
    }),
  );
  app.use(
    "/api/hunts",
    huntsRouter({
      registry: d.registry,
      auth: d.auth,
      isDevelopment: d.nodeEnv !== "production",
      ...(d.now ? { now: d.now } : {}),
    }),
  );
  app.use("/api/chats", chatRouter(d.chat, d.auth, d.registry, d.nodeEnv !== "production"));

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
