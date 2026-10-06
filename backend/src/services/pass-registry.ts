// Registre des pass (personnes vérifiées) — voir docs/anti-bots.md.
//
// Un pass est une identité Semaphore créée sur l'appareil ; le serveur n'en
// connaît que l'empreinte publique (commitment), ajoutée au groupe quand une
// invitation valide est utilisée. Ce qui est conservé :
//   - la liste des empreintes (anonymes : elles ne disent pas qui est qui) ;
//   - l'empreinte (sha256) des invitations non utilisées, avec leur expiration ;
//   - les codes (nullifiers) déjà utilisés pour les quotas d'invitation.
// Jamais : qui a invité qui, ni l'adresse d'un wallet, ni une IP.
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { Group } from "@semaphore-protocol/group";

export const INVITATION_TTL_MS = 7 * 24 * 3600 * 1000;
/** Nombre de racines récentes acceptées (le groupe grandit entre preuve et envoi). */
const ROOT_HISTORY = 100;

export class PassError extends Error {
  constructor(
    public readonly code: "invalid_invitation" | "already_member" | "slot_used",
    message: string,
  ) {
    super(message);
  }
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

interface PassData {
  members: string[];
  invitations: { hash: string; expiresAt: number }[];
  usedGenesis: string[];
  usedSlots: string[];
}

export interface PassRegistryOptions {
  file?: string;
  now?: () => number;
  /** Invitations « de départ » (amorçage du réseau), utilisables une fois chacune. */
  genesisInvites?: string[];
}

export class PassRegistry {
  private readonly group = new Group();
  private readonly memberSet = new Set<string>();
  private readonly roots: string[] = [];
  private readonly invitations = new Map<string, number>();
  private readonly genesis: Set<string>;
  private readonly usedGenesis = new Set<string>();
  private readonly usedSlots = new Set<string>();
  private readonly now: () => number;

  constructor(private readonly options: PassRegistryOptions = {}) {
    this.now = options.now ?? Date.now;
    this.genesis = new Set((options.genesisInvites ?? []).map(sha256));
    this.load();
  }

  /** Empreintes des membres, dans l'ordre d'ajout (nécessaire pour l'arbre). */
  members(): string[] {
    return this.group.members.map(String);
  }

  memberCount(): number {
    return this.memberSet.size;
  }

  /** Racines acceptées pour une preuve (actuelle + récentes). */
  knownRoots(): ReadonlySet<string> {
    return new Set(this.roots);
  }

  /** Crée une invitation (à transmettre hors de Huntited, ex. Signal). */
  createInvitation(): { invitation: string; expiresAt: number } {
    const invitation = randomBytes(24).toString("base64url");
    const expiresAt = this.now() + INVITATION_TTL_MS;
    this.invitations.set(sha256(invitation), expiresAt);
    this.save();
    return { invitation, expiresAt };
  }

  /**
   * Utilise un emplacement de quota (scope d'invitation + code de la preuve) :
   * un même pass ne peut pas réutiliser un emplacement, sans qu'on sache lequel.
   */
  useSlot(scope: string, nullifier: string): void {
    const key = `${scope}|${nullifier}`;
    if (this.usedSlots.has(key)) {
      throw new PassError("slot_used", "Cet emplacement d'invitation est déjà utilisé.");
    }
    this.usedSlots.add(key);
    this.save();
  }

  /** Ajoute un pass au groupe en échange d'une invitation valide. */
  redeem(invitation: string, commitment: string): void {
    const hash = sha256(invitation);
    const expiresAt = this.invitations.get(hash);
    const isGenesis = this.genesis.has(hash) && !this.usedGenesis.has(hash);
    const valid = isGenesis || (expiresAt !== undefined && expiresAt > this.now());
    if (!valid) {
      throw new PassError("invalid_invitation", "Invitation invalide, expirée ou déjà utilisée.");
    }
    if (this.memberSet.has(commitment)) {
      throw new PassError("already_member", "Ce pass est déjà enregistré.");
    }
    if (isGenesis) this.usedGenesis.add(hash);
    else this.invitations.delete(hash);
    this.addMember(commitment);
    this.save();
  }

  private addMember(commitment: string) {
    this.group.addMember(BigInt(commitment));
    this.memberSet.add(commitment);
    this.roots.push(this.group.root.toString());
    if (this.roots.length > ROOT_HISTORY) this.roots.shift();
  }

  // --- Persistance -------------------------------------------------------------

  private load() {
    const file = this.options.file;
    if (!file || !existsSync(file)) return;
    const data = JSON.parse(readFileSync(file, "utf8")) as Partial<PassData>;
    for (const m of data.members ?? []) this.addMember(m);
    const t = this.now();
    for (const i of data.invitations ?? [])
      if (i.expiresAt > t) this.invitations.set(i.hash, i.expiresAt);
    for (const g of data.usedGenesis ?? []) this.usedGenesis.add(g);
    for (const s of data.usedSlots ?? []) this.usedSlots.add(s);
  }

  private save() {
    const file = this.options.file;
    if (!file) return;
    const t = this.now();
    const data: PassData = {
      members: this.members(),
      invitations: [...this.invitations]
        .filter(([, e]) => e > t)
        .map(([hash, expiresAt]) => ({ hash, expiresAt })),
      usedGenesis: [...this.usedGenesis],
      usedSlots: [...this.usedSlots],
    };
    mkdirSync(dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    writeFileSync(tmp, JSON.stringify(data, null, 2));
    renameSync(tmp, file); // écriture atomique
  }
}
