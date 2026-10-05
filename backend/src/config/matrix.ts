// Configuration Matrix complète, réservée au backend (contient le token du bot).
import { env } from "./env.js";

export interface MatrixServerConfig {
  /** URL du homeserver Synapse auto-hébergé, sans fédération. */
  homeserverUrl: string;
  /** Durée de vie ajoutée à la date limite de la chasse (ms). */
  defaultRoomTtlMs: number;
  /** Token du bot : ne jamais le renvoyer au navigateur ni le logger. */
  accessToken: string;
}

export function getMatrixServerConfig(): MatrixServerConfig {
  return {
    homeserverUrl: env.MATRIX_HOMESERVER_URL,
    defaultRoomTtlMs: env.CHAT_DEFAULT_TTL_MS,
    accessToken: env.MATRIX_ACCESS_TOKEN,
  };
}
