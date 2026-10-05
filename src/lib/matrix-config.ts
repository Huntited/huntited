import type { MatrixPublicConfig } from "./matrix-types";

/**
 * Configuration publique utilisée par le front.
 *
 * Le token Matrix du bot reste exclusivement côté backend.
 * Le front communique avec l'API Huntited, jamais directement
 * avec l'API d'administration Matrix.
 */
export const matrixConfig: MatrixPublicConfig = {
  homeserverUrl: import.meta.env["VITE_MATRIX_HOMESERVER_URL"] ?? "https://matrix.huntited.org",
  defaultRoomTtlMs: 24 * 60 * 60 * 1000, // durée de vie ajoutée à la date limite de la chasse : expiresAt = huntDeadline + defaultRoomTtlMs
};
