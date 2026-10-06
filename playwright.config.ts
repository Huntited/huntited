// Tests de parcours de bout en bout (vrai navigateur : Chrome installé).
// Lance un backend et un front dédiés, sur des ports à part, en mode
// registre partagé avec le wallet factice : aucun vrai KAS, aucune donnée
// conservée (registre en mémoire), tes fichiers .env ne sont pas utilisés
// pour les valeurs fournies ici.
import { defineConfig } from "@playwright/test";

import { GENESIS } from "./e2e/genesis";

const FRONT_PORT = 5199;
const API_PORT = 3099;

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${FRONT_PORT}`,
    channel: "chrome",
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "node node_modules/tsx/dist/cli.mjs src/index.ts",
      cwd: "./backend",
      url: `http://localhost:${API_PORT}/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        NODE_ENV: "development",
        PORT: String(API_PORT),
        CORS_ORIGIN: `http://localhost:${FRONT_PORT}`,
        MATRIX_MODE: "mock",
        MATRIX_HOMESERVER_URL: "https://matrix.test",
        AUTH_JWT_SECRET: "e2e-only-secret-not-used-anywhere-else-0123456789",
        WALLET_AUTH_MODE: "mock",
        KASPA_NETWORK: "testnet-10",
        REGISTRY_FILE: "",
        // Une dizaine de personnes simulées depuis la même machine (même IP).
        RATE_LIMIT_MULTIPLIER: "10",
        // Pass exigés pour s'engager (anti-bots), amorcés par des invitations de test.
        PASS_REQUIRED: "true",
        PASS_GENESIS_INVITES: GENESIS.join(","),
      },
    },
    {
      command: `node node_modules/vite/bin/vite.js dev --port ${FRONT_PORT} --strictPort`,
      url: `http://localhost:${FRONT_PORT}`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        VITE_DATA_MODE: "api",
        VITE_MATRIX_MODE: "api",
        VITE_WALLET_MODE: "mock",
        VITE_API_BASE_URL: `http://localhost:${API_PORT}`,
      },
    },
  ],
});
