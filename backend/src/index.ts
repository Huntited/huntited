// Point d'entrée du serveur Huntited (Express, ES modules).
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { AuthService } from "./services/auth-service.js";
import { ChallengeService } from "./services/challenge-service.js";
import { ChatService } from "./services/chat-service.js";
import { MemoryChatStore } from "./services/chat-store.js";
import { MockHuntAccessStore } from "./services/hunt-access-store.js";
import { createMatrixService } from "./services/matrix-service.js";
import { createSignatureVerifier } from "./services/wallet-auth.js";

const chat = new ChatService(
  new MemoryChatStore(),
  createMatrixService(env.MATRIX_MODE, env.MATRIX_HOMESERVER_URL),
);
const app = createApp({
  chat,
  auth: new AuthService(env.AUTH_JWT_SECRET, env.AUTH_TOKEN_TTL_SECONDS),
  access: new MockHuntAccessStore(),
  challenges: new ChallengeService({ appUri: env.CORS_ORIGIN, network: env.KASPA_NETWORK }),
  verifySignature: createSignatureVerifier(env.WALLET_AUTH_MODE, env.KASPA_NETWORK),
  corsOrigin: env.CORS_ORIGIN,
  nodeEnv: env.NODE_ENV,
});

// Nettoyage périodique des salons expirés.
setInterval(() => void chat.cleanExpiredChats(), 60_000).unref();

app.listen(env.PORT, () => console.info(`[server] démarré sur le port ${env.PORT}`));
