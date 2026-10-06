// Choix du fournisseur de chat selon VITE_MATRIX_MODE :
//   "mock" → simulation dans le navigateur (par défaut)
//   "api"  → backend Huntited (qui parle à Matrix)
// Le front reçoit un lien et, avec le vrai serveur Matrix, des identifiants
// temporaires propres à cette chasse (jamais conservés sur l'appareil).
import * as api from "./matrix-api";
import { canCreateRoom, mockCreateChat, mockGetChatStatus } from "./matrix-mock";
import type { SettlementOutcome } from "./hunt-state-store";
import type { HuntStatus } from "./types";

export interface ChatAccess {
  inviteLink: string;
  expiresAt: number;
  login?: api.ChatLogin;
}

const access = (r: api.PublicChatResponse): ChatAccess | null =>
  r.isActive && r.inviteLink && r.expiresAt
    ? { inviteLink: r.inviteLink, expiresAt: r.expiresAt, ...(r.login ? { login: r.login } : {}) }
    : null;

export const chatMode: "mock" | "api" =
  import.meta.env["VITE_MATRIX_MODE"] === "api" ? "api" : "mock";

export async function getChat(huntId: string, token: string | null): Promise<ChatAccess | null> {
  if (chatMode === "api") {
    if (!token) return null;
    return access(await api.getChatStatus(huntId, token));
  }
  const r = await mockGetChatStatus(huntId);
  return r.isActive && r.room?.inviteLink && r.room.expiresAt
    ? { inviteLink: r.room.inviteLink, expiresAt: r.room.expiresAt }
    : null;
}

export async function openChat(
  hunt: { id: string; title: string },
  expiresAt: number,
  status: HuntStatus,
  outcome: SettlementOutcome | undefined,
  token: string | null,
): Promise<ChatAccess> {
  // Un salon n'existe qu'après activation (ou résolution en succès).
  if (!canCreateRoom(status, outcome)) throw new Error("Chat indisponible avant l'activation.");
  if (chatMode === "api") {
    if (!token) throw new api.ChatApiError("Accès au chat refusé.");
    const r = await api.createChat(
      { huntId: hunt.id, huntName: hunt.title.slice(0, 80), expiresAt },
      token,
    );
    const a = access(r);
    if (!a) throw new api.ChatApiError("Le chat est temporairement indisponible.");
    return a;
  }
  const r = await mockCreateChat(hunt.id, expiresAt, status, outcome);
  return { inviteLink: r.inviteLink, expiresAt: r.expiresAt };
}
