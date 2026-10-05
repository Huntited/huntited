// Types du chat de coordination (Matrix).

export type ChatState = "active" | "expired";

export interface CreateChatInput {
  huntId: string;
  huntName: string;
  /** Timestamp (ms) d'expiration du salon. */
  expiresAt: number;
}

/** Enregistrement interne : ne quitte jamais le backend tel quel. */
export interface ChatRecord {
  huntId: string;
  roomId: string;
  inviteLink: string;
  createdAt: number;
  expiresAt: number;
  state: ChatState;
}

/** Contrat public envoyé au front : jamais de roomId. */
export interface PublicChatResponse {
  isActive: boolean;
  expiresAt?: number;
  inviteLink?: string;
}
