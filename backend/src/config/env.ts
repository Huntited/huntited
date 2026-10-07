// Chargement et validation des variables d'environnement (au démarrage).
// En cas d'erreur, on n'affiche que les NOMS des variables invalides,
// jamais leurs valeurs (le token Matrix ne doit fuiter nulle part).
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    // Une ou plusieurs origines autorisées, séparées par des virgules
    // (ex. le PC et un téléphone sur le même réseau).
    CORS_ORIGIN: z
      .string()
      .transform((s) =>
        s
          .split(",")
          .map((o) => o.trim())
          .filter(Boolean),
      )
      .pipe(z.array(z.string().url()).min(1)),
    MATRIX_MODE: z.enum(["mock", "synapse"]).default("mock"),
    MATRIX_HOMESERVER_URL: z.string().url(),
    MATRIX_ACCESS_TOKEN: z.string().default(""),
    // Synapse : nom du serveur (@x:<nom>) et application Element à ouvrir.
    MATRIX_SERVER_NAME: z.string().default(""),
    MATRIX_CLIENT_URL: z.string().default(""),
    CHAT_DEFAULT_TTL_MS: z.coerce.number().int().positive().default(86_400_000),
    // Fichier JSON des salons ouverts ; vide = mémoire (un redémarrage les
    // rendrait impossibles à fermer automatiquement : à remplir en production).
    CHAT_FILE: z.string().default(""),
    AUTH_JWT_SECRET: z.string().min(32),
    AUTH_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
    // Durée de la session obtenue par signature (une signature par visite).
    AUTH_SESSION_TTL_SECONDS: z.coerce.number().int().min(60).max(86_400).default(3600),
    // Fichier JSON du registre des chasses ; vide = mémoire (perdu au redémarrage).
    REGISTRY_FILE: z.string().default(""),
    // Nombre de proxys devant le serveur (hébergeur) : 0 en local, souvent 1
    // en ligne. Sans cela, tous les visiteurs partagent la même limite de fréquence.
    TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
    // Seul le testnet est accepté tant qu'aucune transaction réelle n'est prévue.
    KASPA_NETWORK: z.enum(["testnet-10"]).default("testnet-10"),
    // signature = vraie vérification Kaspa ; mock = wallet factice (dev uniquement).
    WALLET_AUTH_MODE: z.enum(["signature", "mock"]).default("signature"),
    // Multiplie les limites de fréquence par IP (ex. beaucoup de monde derrière
    // une même box ou un même opérateur mobile, ou tests automatiques).
    RATE_LIMIT_MULTIPLIER: z.coerce.number().int().min(1).max(100).default(1),
    // Seuil minimum d'une chasse. Abaissable en développement uniquement
    // (tests à 2 navigateurs) ; toujours 7 en production.
    MIN_HUNT_THRESHOLD: z.coerce.number().int().min(1).max(7).default(7),
    // Pass Huntited (anti-bots, voir docs/anti-bots.md), en réserve. Exigé pour
    // s'engager : « true »/« false » ; par défaut non (tout le monde peut rejoindre).
    PASS_REQUIRED: z.enum(["true", "false"]).optional(),
    // Fichier JSON des pass (empreintes anonymes) ; vide = mémoire seulement.
    PASS_FILE: z.string().default(""),
    // Invitations de départ (amorçage), séparées par des virgules, 24 caractères min.
    PASS_GENESIS_INVITES: z
      .string()
      .default("")
      .transform((s) =>
        s
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
      )
      .pipe(z.array(z.string().regex(/^[\w-]{24,128}$/))),
    PASS_INVITES_PER_MONTH: z.coerce.number().int().min(1).max(20).default(3),
    // Notifications « me prévenir » (Web Push). Vides = désactivées.
    // Générer la paire : npx web-push generate-vapid-keys. Clé privée backend-only.
    PUSH_VAPID_PUBLIC_KEY: z.string().default(""),
    PUSH_VAPID_PRIVATE_KEY: z.string().default(""),
    PUSH_SUBJECT: z.string().default("mailto:Huntited@proton.me"),
    // Fichier JSON des abonnements ; vide = mémoire seulement.
    PUSH_FILE: z.string().default(""),
  })
  .refine((e) => !e.PUSH_VAPID_PRIVATE_KEY || e.PUSH_VAPID_PUBLIC_KEY.length > 0, {
    message: "PUSH_VAPID_PUBLIC_KEY requis avec PUSH_VAPID_PRIVATE_KEY",
    path: ["PUSH_VAPID_PUBLIC_KEY"],
  })
  .refine((e) => e.NODE_ENV !== "production" || e.MIN_HUNT_THRESHOLD === 7, {
    message: "MIN_HUNT_THRESHOLD ne peut pas être abaissé en production",
    path: ["MIN_HUNT_THRESHOLD"],
  })
  .refine((e) => e.MATRIX_MODE === "mock" || e.MATRIX_ACCESS_TOKEN.length > 0, {
    message: "MATRIX_ACCESS_TOKEN requis en mode synapse",
    path: ["MATRIX_ACCESS_TOKEN"],
  })
  .refine(
    (e) =>
      e.MATRIX_MODE === "mock" ||
      (e.MATRIX_SERVER_NAME.length > 0 && /^https:\/\//.test(e.MATRIX_CLIENT_URL)),
    {
      message: "MATRIX_SERVER_NAME et MATRIX_CLIENT_URL (https) requis en mode synapse",
      path: ["MATRIX_CLIENT_URL"],
    },
  )
  .refine((e) => e.MATRIX_MODE === "mock" || e.CHAT_FILE.length > 0, {
    message: "CHAT_FILE requis en mode synapse (salons à fermer après un redémarrage)",
    path: ["CHAT_FILE"],
  })
  .refine((e) => e.NODE_ENV !== "production" || e.WALLET_AUTH_MODE === "signature", {
    message: "WALLET_AUTH_MODE=mock interdit en production",
    path: ["WALLET_AUTH_MODE"],
  });

export type Env = z.infer<typeof schema>;

function loadEnv(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const names = [...new Set(parsed.error.issues.map((i) => i.path.join(".")))];
    console.error(`[config] variables invalides : ${names.join(", ")}`);
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();
