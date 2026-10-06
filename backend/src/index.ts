// Point d'entrée du serveur Huntited (Express, ES modules).
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { AuthService } from "./services/auth-service.js";
import { ChallengeService } from "./services/challenge-service.js";
import { ChatService } from "./services/chat-service.js";
import { createChatStore } from "./services/chat-store.js";
import { HuntRegistry } from "./services/hunt-registry.js";
import { createMatrixService } from "./services/matrix-service.js";
import { runMaintenance } from "./services/maintenance.js";
import { PassRegistry } from "./services/pass-registry.js";
import { createWebPushSender, PushService } from "./services/push-service.js";
import { createSignatureVerifier } from "./services/wallet-auth.js";

const chat = new ChatService(
  createChatStore(env.CHAT_FILE),
  createMatrixService(env.MATRIX_MODE, env.MATRIX_HOMESERVER_URL, {
    serverName: env.MATRIX_SERVER_NAME,
    accessToken: env.MATRIX_ACCESS_TOKEN,
    clientUrl: env.MATRIX_CLIENT_URL,
  }),
);
const registry = new HuntRegistry(env.REGISTRY_FILE ? { file: env.REGISTRY_FILE } : {});

// Notifications : actives seulement si les clés VAPID sont fournies.
const push = env.PUSH_VAPID_PRIVATE_KEY
  ? new PushService(
      await createWebPushSender({
        publicKey: env.PUSH_VAPID_PUBLIC_KEY,
        privateKey: env.PUSH_VAPID_PRIVATE_KEY,
        subject: env.PUSH_SUBJECT,
      }),
      env.PUSH_FILE ? { file: env.PUSH_FILE } : {},
    )
  : undefined;

const app = createApp({
  chat,
  auth: new AuthService(
    env.AUTH_JWT_SECRET,
    env.AUTH_TOKEN_TTL_SECONDS,
    Date.now,
    env.AUTH_SESSION_TTL_SECONDS,
  ),
  registry,
  ...(push ? { push: { service: push, publicKey: env.PUSH_VAPID_PUBLIC_KEY } } : {}),
  // L'URI affichée dans le message à signer est l'origine principale.
  challenges: new ChallengeService({ appUri: env.CORS_ORIGIN[0]!, network: env.KASPA_NETWORK }),
  verifySignature: createSignatureVerifier(env.WALLET_AUTH_MODE, env.KASPA_NETWORK),
  corsOrigin: env.CORS_ORIGIN,
  chatTtlMs: env.CHAT_DEFAULT_TTL_MS,
  nodeEnv: env.NODE_ENV,
  trustProxy: env.TRUST_PROXY,
  rateLimitMultiplier: env.RATE_LIMIT_MULTIPLIER,
  minThreshold: env.MIN_HUNT_THRESHOLD,
  passes: {
    registry: new PassRegistry({
      ...(env.PASS_FILE ? { file: env.PASS_FILE } : {}),
      genesisInvites: env.PASS_GENESIS_INVITES,
    }),
    required: (env.PASS_REQUIRED ?? (env.NODE_ENV === "production" ? "true" : "false")) === "true",
    invitesPerMonth: env.PASS_INVITES_PER_MONTH,
  },
});

// Salons expirés, notifications de fin, effacement des chasses ratées.
setInterval(
  () => void runMaintenance({ registry, chat, ...(push ? { push } : {}) }),
  60_000,
).unref();

app.listen(env.PORT, () => console.info(`[server] démarré sur le port ${env.PORT}`));
