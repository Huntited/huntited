// Adaptateur Matrix : mock (développement, tests) ou Synapse auto-hébergé.
// Aucun log de roomId, de lien, d'identifiant de compte ni de token.
//
// Synapse (voir docs/matrix.md) :
//   - salon privé, non fédéré, chiffré de bout en bout, historique visible
//     seulement depuis l'arrivée de chacun ;
//   - un compte temporaire par personne et par chasse, sans lien avec son
//     wallet (identifiant aléatoire, pseudonyme « Participant·e N »), ajouté
//     au salon par l'API d'administration ; la personne reçoit son
//     identifiant et un mot de passe temporaire pour se connecter dans
//     Element (qui assure le chiffrement de bout en bout) ;
//   - à l'expiration : salon supprimé (membres expulsés, historique purgé),
//     comptes temporaires désactivés et effacés.
import { randomBytes, randomUUID } from "node:crypto";

import type { CreateChatInput } from "../types/chat.js";

/** Identifiants de connexion temporaires, remis à la seule personne concernée. */
export interface MatrixLogin {
  /** Application de chat à ouvrir (Element configuré sur le serveur Huntited). */
  clientUrl: string;
  homeserverUrl: string;
  username: string;
  password: string;
}

export interface MatrixService {
  createPrivateRoom(input: CreateChatInput): Promise<{ roomId: string; inviteLink: string }>;
  /**
   * Donne accès au salon à une personne : crée (ou réutilise) son compte
   * temporaire et l'ajoute au salon. En mode mock, aucun identifiant.
   */
  grantAccess(
    roomId: string,
    member: { userId?: string | undefined; displayName: string },
  ): Promise<{ userId: string; login?: MatrixLogin }>;
  /** Supprime le salon et les comptes temporaires de ses membres. */
  closeRoom(roomId: string, memberUserIds: string[]): Promise<void>;
}

export class MockMatrixService implements MatrixService {
  constructor(private readonly homeserverUrl: string) {}

  async createPrivateRoom(_input: CreateChatInput) {
    const roomId = `!mock_${randomUUID().slice(0, 12)}:huntited`;
    // Lien d'invitation opaque, sans le roomId (rien ne relie le lien au salon).
    return { roomId, inviteLink: `${this.homeserverUrl}/#/invite/${randomUUID()}` };
  }

  async grantAccess(_roomId: string, member: { userId?: string | undefined }) {
    return { userId: member.userId ?? `@mock_${randomUUID().slice(0, 8)}:huntited` };
  }

  async closeRoom(_roomId: string, _memberUserIds: string[]) {
    // Rien à fermer en mode mock.
  }
}

export class MatrixError extends Error {
  constructor(public readonly step: string) {
    // Message sans identifiant ni token.
    super(`matrix_${step}_failed`);
  }
}

export interface SynapseOptions {
  /** URL du serveur Synapse (ex. https://matrix.huntited.org). */
  homeserverUrl: string;
  /** Nom du serveur dans les identifiants (ex. huntited.org pour @x:huntited.org). */
  serverName: string;
  /** Jeton du compte « bot » administrateur (backend uniquement). */
  accessToken: string;
  /** Application Element configurée sur ce serveur (ex. https://chat.huntited.org). */
  clientUrl: string;
  fetch?: typeof fetch;
}

export class SynapseMatrixService implements MatrixService {
  private readonly http: typeof fetch;

  constructor(private readonly o: SynapseOptions) {
    this.http = o.fetch ?? fetch;
  }

  private async call(step: string, method: string, path: string, body?: unknown) {
    let res: Response;
    try {
      res = await this.http(`${this.o.homeserverUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.o.accessToken}`,
          "Content-Type": "application/json",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new MatrixError(step);
    }
    if (!res.ok) throw new MatrixError(step);
    return (await res.json().catch(() => ({}))) as Record<string, unknown>;
  }

  async createPrivateRoom(input: CreateChatInput) {
    const r = await this.call("create_room", "POST", "/_matrix/client/v3/createRoom", {
      preset: "private_chat",
      visibility: "private",
      name: input.huntName,
      topic: "Huntited",
      // Salon réservé à ce serveur : aucune copie ailleurs dans le réseau Matrix.
      creation_content: { "m.federate": false },
      initial_state: [
        {
          type: "m.room.encryption",
          state_key: "",
          content: { algorithm: "m.megolm.v1.aes-sha2" },
        },
        // Chacun ne voit que les messages postérieurs à son arrivée.
        {
          type: "m.room.history_visibility",
          state_key: "",
          content: { history_visibility: "joined" },
        },
        { type: "m.room.guest_access", state_key: "", content: { guest_access: "forbidden" } },
        { type: "m.room.join_rules", state_key: "", content: { join_rule: "invite" } },
      ],
    });
    const roomId = r["room_id"];
    if (typeof roomId !== "string") throw new MatrixError("create_room");
    return { roomId, inviteLink: `${this.o.clientUrl}/#/room/${encodeURIComponent(roomId)}` };
  }

  async grantAccess(roomId: string, member: { userId?: string | undefined; displayName: string }) {
    const userId = member.userId ?? `@h${randomBytes(8).toString("hex")}:${this.o.serverName}`;
    // Nouveau mot de passe à chaque demande : seul le dernier remis est valable.
    const password = randomBytes(18).toString("base64url");
    await this.call("user", "PUT", `/_synapse/admin/v2/users/${encodeURIComponent(userId)}`, {
      password,
      displayname: member.displayName,
      admin: false,
      logout_devices: false,
    });
    await this.call("join", "POST", `/_synapse/admin/v1/join/${encodeURIComponent(roomId)}`, {
      user_id: userId,
    });
    return {
      userId,
      login: {
        clientUrl: this.o.clientUrl,
        homeserverUrl: this.o.homeserverUrl,
        username: userId,
        password,
      },
    };
  }

  async closeRoom(roomId: string, memberUserIds: string[]) {
    // Expulse tout le monde, bloque le salon et purge son historique.
    await this.call(
      "delete_room",
      "DELETE",
      `/_synapse/admin/v2/rooms/${encodeURIComponent(roomId)}`,
      {
        block: true,
        purge: true,
      },
    );
    for (const userId of memberUserIds) {
      // Désactive et efface le compte temporaire (nom, avatar, messages).
      await this.call(
        "deactivate",
        "POST",
        `/_synapse/admin/v1/deactivate/${encodeURIComponent(userId)}`,
        { erase: true },
      );
    }
  }
}

export function createMatrixService(
  mode: "mock" | "synapse",
  homeserverUrl: string,
  synapse?: Omit<SynapseOptions, "homeserverUrl">,
): MatrixService {
  if (mode === "synapse") {
    if (!synapse) throw new Error("Configuration Synapse manquante.");
    return new SynapseMatrixService({ homeserverUrl, ...synapse });
  }
  return new MockMatrixService(homeserverUrl);
}
