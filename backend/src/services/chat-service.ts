// Logique métier du chat. Indépendante d'Express et de la config (testable).
// Logs : événements anonymes uniquement, sans aucun identifiant.
//
// NB : la vérification « hunt activated ou settled-success » sera faite ici
// en lisant l'état du covenant Kaspa. En attendant, le front ne demande un
// salon qu'après activation.
import type { ChatStore } from "./chat-store.js";
import type { MatrixService } from "./matrix-service.js";
import type { ChatRecord, CreateChatInput, PublicChatResponse } from "../types/chat.js";

export class ChatServiceError extends Error {
  constructor(public readonly code: "invalid" | "conflict", message: string) {
    super(message);
  }
}

const logEvent = (name: string) => console.info(`[chat] ${name}`);

function toPublic(r: ChatRecord): PublicChatResponse {
  return { isActive: true, expiresAt: r.expiresAt, inviteLink: r.inviteLink };
}

export class ChatService {
  constructor(
    private readonly store: ChatStore,
    private readonly matrix: MatrixService,
    private readonly now: () => number = Date.now,
  ) {}

  async createChat(input: CreateChatInput): Promise<PublicChatResponse> {
    if (input.expiresAt <= this.now()) {
      throw new ChatServiceError("invalid", "La date d'expiration est passée.");
    }
    const existing = this.store.get(input.huntId);
    if (existing && existing.expiresAt > this.now()) return toPublic(existing);
    if (existing) await this.close(existing);

    const { roomId, inviteLink } = await this.matrix.createPrivateRoom(input);
    const record: ChatRecord = {
      huntId: input.huntId,
      roomId,
      inviteLink,
      createdAt: this.now(),
      expiresAt: input.expiresAt,
      state: "active",
    };
    this.store.set(record);
    logEvent("chat_created");
    return toPublic(record);
  }

  async getChatStatus(huntId: string): Promise<PublicChatResponse> {
    const r = this.store.get(huntId);
    if (!r) return { isActive: false };
    if (r.expiresAt <= this.now()) {
      await this.close(r);
      return { isActive: false };
    }
    return toPublic(r);
  }

  async cleanExpiredChats(now: number = this.now()): Promise<number> {
    const expired = this.store.all().filter((r) => r.expiresAt <= now);
    for (const r of expired) await this.close(r);
    return expired.length;
  }

  private async close(r: ChatRecord) {
    await this.matrix.closeRoom(r.roomId);
    this.store.delete(r.huntId);
    logEvent("chat_expired");
  }
}
