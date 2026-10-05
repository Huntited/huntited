// Stockage des salons. Développement : mémoire du processus (perdu au redémarrage).
import type { ChatRecord } from "../types/chat.js";

export interface ChatStore {
  get(huntId: string): ChatRecord | undefined;
  set(record: ChatRecord): void;
  delete(huntId: string): void;
  all(): ChatRecord[];
}

export class MemoryChatStore implements ChatStore {
  private readonly records = new Map<string, ChatRecord>();
  get(huntId: string) {
    return this.records.get(huntId);
  }
  set(record: ChatRecord) {
    this.records.set(record.huntId, record);
  }
  delete(huntId: string) {
    this.records.delete(huntId);
  }
  all() {
    return [...this.records.values()];
  }
}
