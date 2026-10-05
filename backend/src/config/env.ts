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
    CORS_ORIGIN: z.string().url(),
    MATRIX_MODE: z.enum(["mock", "synapse"]).default("mock"),
    MATRIX_HOMESERVER_URL: z.string().url(),
    MATRIX_ACCESS_TOKEN: z.string().default(""),
    CHAT_DEFAULT_TTL_MS: z.coerce.number().int().positive().default(86_400_000),
    AUTH_JWT_SECRET: z.string().min(32),
    AUTH_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  })
  .refine((e) => e.MATRIX_MODE === "mock" || e.MATRIX_ACCESS_TOKEN.length > 0, {
    message: "MATRIX_ACCESS_TOKEN requis en mode synapse",
    path: ["MATRIX_ACCESS_TOKEN"],
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
