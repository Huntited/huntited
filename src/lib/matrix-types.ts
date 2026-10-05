/**
 * Types pour l'intégration Matrix (chat E2EE par chasse).
 *
 * Pour l'instant, ce sont juste des définitions partagées.
 * L'implémentation réelle se fera côté serveur : le front ne parlera
 * jamais directement au homeserver avec un token de service.
 */

export interface MatrixRoom {
  roomId: string;
  alias?: string;
  name: string;
  /** Lien d'invitation éphémère (partagé uniquement avec les engagés). */
  inviteLink?: string;
  createdAt: number;
  /** Timestamp d'expiration de la room (fin de la chasse). */
  expiresAt?: number;
}

/** Configuration Matrix sans secret, utilisable dans le navigateur. */
export interface MatrixPublicConfig {
  /** URL du homeserver Matrix auto-hébergé (sans fédération). */
  homeserverUrl: string;
  /** Durée de vie par défaut des rooms (en ms). */
  defaultRoomTtlMs: number;
}

/*
 * MatrixServerConfig (avec le token du bot) est volontairement absent du front :
 * elle est définie uniquement dans backend/src/config/matrix.ts.
 */

/** Réponse de l'API backend à la création d'un chat. */
export interface CreateChatResponse {
  roomId: string;
  inviteLink: string;
  expiresAt: number;
}

/** Réponse de l'API backend à la vérification de l'état d'un chat. */
export interface ChatStatusResponse {
  isActive: boolean;
  room?: MatrixRoom;
  error?: string;
}
