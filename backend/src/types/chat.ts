// Types du chat de coordination (Matrix).
import type { MatrixLogin } from "../services/matrix-service.js";

export type ChatState = "active" | "expired";

export interface CreateChatInput {
  huntId: string;
  huntName: string;
  /** Timestamp (ms) d'expiration du salon. */
  expiresAt: number;
}

/** Personne qui demande l'accès au chat (clé propre à la chasse, jamais le wallet). */
export interface ChatMember {
  /** Empreinte propre à la chasse et au wallet (sha256), ne révèle pas le wallet. */
  key: string;
  role: "creator" | "participant";
}

/** Enregistrement interne : ne quitte jamais le backend tel quel. */
export interface ChatRecord {
  huntId: string;
  roomId: string;
  inviteLink: string;
  createdAt: number;
  expiresAt: number;
  state: ChatState;
  /** Comptes temporaires du salon : clé de membre → identifiant Matrix. */
  members?: Record<string, string>;
}

/** Contrat public envoyé au front. */
export interface PublicChatResponse {
  isActive: boolean;
  expiresAt?: number;
  inviteLink?: string;
  /** Identifiants temporaires de la personne qui demande (Synapse uniquement). */
  login?: MatrixLogin;
}
