import { apiBaseUrl as baseUrl } from "./chat-access-api";
// Client HTTP du front vers le backend Huntited (chat Matrix).
// Aucun token Matrix ici ; aucun log de lien ni d'identifiant.

/** Contrat public du backend : jamais de roomId. */
export interface PublicChatResponse {
  isActive: boolean;
  expiresAt?: number;
  inviteLink?: string;
}

export class ChatApiError extends Error {}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

async function parse(res: Response): Promise<PublicChatResponse> {
  if (res.status === 404) return { isActive: false };
  if (res.status === 401 || res.status === 403) throw new ChatApiError("Accès au chat refusé.");
  if (!res.ok) throw new ChatApiError("Le chat est temporairement indisponible.");
  return (await res.json()) as PublicChatResponse;
}

export async function createChat(
  input: { huntId: string; huntName: string; expiresAt: number },
  token: string,
): Promise<PublicChatResponse> {
  try {
    const res = await fetch(`${baseUrl()}/api/chats`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth(token) },
      body: JSON.stringify(input),
    });
    return await parse(res);
  } catch (e) {
    if (e instanceof ChatApiError) throw e;
    throw new ChatApiError("Le chat est temporairement indisponible.");
  }
}

export async function getChatStatus(huntId: string, token: string): Promise<PublicChatResponse> {
  try {
    return await parse(await fetch(`${baseUrl()}/api/chats/${encodeURIComponent(huntId)}`, { headers: auth(token) }));
  } catch (e) {
    if (e instanceof ChatApiError) throw e;
    throw new ChatApiError("Le chat est temporairement indisponible.");
  }
}
