import type { CreateChatResponse, ChatStatusResponse } from "./matrix-types";
import type { SettlementOutcome } from "./hunt-state-store";
import type { HuntStatus } from "./types";

/**
 * Mock des appels Matrix, persisté dans localStorage ("huntited:mock-chat-rooms").
 *
 * Dans la version réelle, le backend crée la room Matrix (E2EE, sans
 * fédération) et vérifie lui-même l'activation via le covenant.
 *
 * Privacy-first : aucun log de roomId, de lien d'invitation ou d'id de chasse.
 */

export const CHAT_ROOMS_KEY = "huntited:mock-chat-rooms";

export interface StoredChatRoom {
  huntId: string;
  roomId: string;
  inviteLink: string;
  createdAt: number;
  expiresAt: number;
}

const isBrowser = () => typeof window !== "undefined";
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

function readRooms(): Record<string, StoredChatRoom> {
  if (!isBrowser()) return {};
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(CHAT_ROOMS_KEY) ?? "{}");
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, StoredChatRoom>)
      : {};
  } catch {
    return {};
  }
}

function writeRooms(rooms: Record<string, StoredChatRoom>) {
  if (isBrowser()) window.localStorage.setItem(CHAT_ROOMS_KEY, JSON.stringify(rooms));
}

/** Une room ne peut exister que pour une chasse activée ou résolue en succès. */
export function canCreateRoom(status: HuntStatus, outcome?: SettlementOutcome): boolean {
  return status === "activated" || (status === "settled" && outcome === "success");
}

/** Crée (ou renvoie) la room mockée d'une chasse. */
export async function mockCreateChat(
  huntId: string,
  expiresAt: number,
  status: HuntStatus,
  outcome?: SettlementOutcome,
  opts: { delayMs?: number } = {},
): Promise<CreateChatResponse> {
  if (!canCreateRoom(status, outcome)) {
    throw new Error("Le chat ne peut être créé qu'après l'activation de la chasse.");
  }
  await delay(opts.delayMs ?? 800);

  const rooms = readRooms();
  const existing = rooms[huntId];
  if (existing && existing.expiresAt > Date.now()) return existing;

  const suffix = crypto.randomUUID().slice(0, 8);
  const roomId = `!mock_${suffix}:matrix.huntited.org`;
  const room: StoredChatRoom = {
    huntId,
    roomId,
    inviteLink: `https://matrix.huntited.org/#/room/${roomId}`,
    createdAt: Date.now(),
    expiresAt,
  };
  rooms[huntId] = room;
  writeRooms(rooms);
  return room;
}

/** État du chat : inactif si aucune room ; une room expirée est supprimée. */
export async function mockGetChatStatus(
  huntId: string,
  opts: { delayMs?: number; now?: number } = {},
): Promise<ChatStatusResponse> {
  await delay(opts.delayMs ?? 300);
  const rooms = readRooms();
  const room = rooms[huntId];
  if (!room) return { isActive: false };
  if (room.expiresAt <= (opts.now ?? Date.now())) {
    delete rooms[huntId];
    writeRooms(rooms);
    return { isActive: false, error: "Le salon a expiré." };
  }
  return {
    isActive: true,
    room: {
      roomId: room.roomId,
      inviteLink: room.inviteLink,
      expiresAt: room.expiresAt,
      createdAt: room.createdAt,
      name: "Chat de coordination",
    },
  };
}
