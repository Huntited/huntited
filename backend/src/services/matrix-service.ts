// Adaptateur Matrix. Aujourd'hui : mock. Demain : Synapse auto-hébergé.
// Aucun log de roomId, de lien d'invitation ni du token.
import { randomUUID } from "node:crypto";

import type { CreateChatInput } from "../types/chat.js";

export interface MatrixService {
  createPrivateRoom(input: CreateChatInput): Promise<{ roomId: string; inviteLink: string }>;
  closeRoom(roomId: string): Promise<void>;
}

export class MockMatrixService implements MatrixService {
  constructor(private readonly homeserverUrl: string) {}

  async createPrivateRoom(_input: CreateChatInput) {
    const roomId = `!mock_${randomUUID().slice(0, 12)}:huntited`;
    // Lien d'invitation opaque, sans le roomId (rien ne relie le lien au salon).
    return { roomId, inviteLink: `${this.homeserverUrl}/#/invite/${randomUUID()}` };
  }

  async closeRoom(_roomId: string) {
    // Rien à fermer en mode mock.
  }
}

// ---------------------------------------------------------------------------
// TODO Synapse réel (isolé ici, rien d'autre ne change) :
//   - createRoom({ visibility: "private", preset: "private_chat",
//       creation_content: { "m.federate": false },
//       initial_state: [{ type: "m.room.encryption", content: { algorithm: "m.megolm.v1.aes-sha2" } }] })
//   - lien d'invitation éphémère par engagé (jamais global) ;
//   - closeRoom : expulser les membres puis oublier le salon.
// ---------------------------------------------------------------------------

export function createMatrixService(mode: "mock" | "synapse", homeserverUrl: string): MatrixService {
  if (mode === "synapse") throw new Error("Mode synapse non implémenté.");
  return new MockMatrixService(homeserverUrl);
}
