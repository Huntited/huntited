// Logique métier du chat. Indépendante d'Express et de la config (testable).
// Logs : événements anonymes uniquement, sans aucun identifiant.
//
// Chaque personne autorisée (créateur ou engagé·e retenu·e, vérifié par la
// route) reçoit son propre accès : un compte temporaire propre à la chasse,
// réutilisé si elle revient, supprimé avec le salon à l'expiration.
import type { ChatStore } from "./chat-store.js";
import type { MatrixService } from "./matrix-service.js";
import type { ChatMember, ChatRecord, CreateChatInput, PublicChatResponse } from "../types/chat.js";

export class ChatServiceError extends Error {
  constructor(
    public readonly code: "invalid" | "conflict",
    message: string,
  ) {
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

  async createChat(input: CreateChatInput, member?: ChatMember): Promise<PublicChatResponse> {
    if (input.expiresAt <= this.now()) {
      throw new ChatServiceError("invalid", "La date d'expiration est passée.");
    }
    const existing = this.store.get(input.huntId);
    if (existing && existing.expiresAt > this.now()) return this.withAccess(existing, member);
    if (existing) await this.close(existing);

    const { roomId, inviteLink } = await this.matrix.createPrivateRoom(input);
    const record: ChatRecord = {
      huntId: input.huntId,
      roomId,
      inviteLink,
      createdAt: this.now(),
      expiresAt: input.expiresAt,
      state: "active",
      members: {},
    };
    this.store.set(record);
    logEvent("chat_created");
    return this.withAccess(record, member);
  }

  async getChatStatus(huntId: string, member?: ChatMember): Promise<PublicChatResponse> {
    const r = this.store.get(huntId);
    if (!r) return { isActive: false };
    if (r.expiresAt <= this.now()) {
      await this.close(r);
      return { isActive: false };
    }
    return this.withAccess(r, member);
  }

  async cleanExpiredChats(now: number = this.now()): Promise<number> {
    const expired = this.store.all().filter((r) => r.expiresAt <= now);
    for (const r of expired) await this.close(r);
    return expired.length;
  }

  /** Ajoute au salon le compte temporaire de la personne (créé au besoin). */
  private async withAccess(r: ChatRecord, member?: ChatMember): Promise<PublicChatResponse> {
    if (!member) return toPublic(r);
    const members = r.members ?? {};
    const known = members[member.key];
    const displayName =
      member.role === "creator"
        ? "Créateur·rice"
        : `Participant·e ${known ? Object.keys(members).indexOf(member.key) + 1 : Object.keys(members).length + 1}`;
    const { userId, login } = await this.matrix.grantAccess(r.roomId, {
      userId: known,
      displayName,
    });
    if (!known) {
      this.store.set({ ...r, members: { ...members, [member.key]: userId } });
      logEvent("chat_member_added");
    }
    return { ...toPublic(r), ...(login ? { login } : {}) };
  }

  private async close(r: ChatRecord) {
    await this.matrix.closeRoom(r.roomId, Object.values(r.members ?? {}));
    this.store.delete(r.huntId);
    logEvent("chat_expired");
  }
}
