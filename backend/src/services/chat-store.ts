// Stockage des salons : en mémoire (développement, tests) ou dans un fichier
// JSON, pour qu'un redémarrage n'empêche pas de fermer les salons ouverts.
// Contenu : id de chasse → salon, comptes temporaires (empreintes propres à
// la chasse → identifiants Matrix). Aucun wallet, aucun mot de passe.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import type { ChatRecord } from "../types/chat.js";

export interface ChatStore {
  get(huntId: string): ChatRecord | undefined;
  set(record: ChatRecord): void;
  delete(huntId: string): void;
  all(): ChatRecord[];
}

export class MemoryChatStore implements ChatStore {
  protected readonly records = new Map<string, ChatRecord>();
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

/** Salons gardés dans un fichier JSON (écriture atomique à chaque changement). */
export class FileChatStore extends MemoryChatStore {
  constructor(private readonly file: string) {
    super();
    if (existsSync(file)) {
      for (const r of JSON.parse(readFileSync(file, "utf8")) as ChatRecord[]) {
        this.records.set(r.huntId, r);
      }
    }
  }
  override set(record: ChatRecord) {
    super.set(record);
    this.save();
  }
  override delete(huntId: string) {
    super.delete(huntId);
    this.save();
  }
  private save() {
    mkdirSync(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.all()));
    renameSync(tmp, this.file);
  }
}

export function createChatStore(file: string): ChatStore {
  return file ? new FileChatStore(file) : new MemoryChatStore();
}
