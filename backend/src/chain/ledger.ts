// Grand livre du registre : rejoue les messages lus sur la chaîne, dans
// l'ordre de la chaîne, et en déduit l'état des pass et des chasses.
// Déterministe : deux index qui lisent les mêmes transactions obtiennent
// exactement le même état (aucune horloge locale, seulement l'heure des blocs).
//
// Un message invalide est simplement ignoré (avec sa raison) : n'importe qui
// peut écrire n'importe quoi vers l'adresse du registre.
import { Group } from "@semaphore-protocol/group";
import { verifyProof } from "@semaphore-protocol/proof";

import {
  computeRetainedGroup,
  isRetained,
  type RetainedGroup,
} from "../services/retained-group.js";
import type { ProofInput } from "../services/semaphore.js";
import {
  INVITATION_TTL_MS,
  MAX_DEADLINE_MS,
  MAX_PERSONAL_THRESHOLD,
  ROOT_HISTORY,
  createScope,
  decodeMessage,
  huntDigest,
  huntScope,
  inviteDigest,
  inviteScope,
  monthOf,
  scopeField,
  verifyRedeem,
  type CommitMessage,
  type Genesis,
  type HuntMessage,
  type InviteMessage,
  type PassMessage,
} from "./protocol.js";

/** Transaction lue sur la chaîne (heure du bloc qui l'a acceptée, en ms). */
export interface ChainEvent {
  txId: string;
  time: number;
  payload: Uint8Array;
}

export type ApplyResult =
  { ok: true; type: "invite" | "pass" | "hunt" | "commit" } | { ok: false; reason: string };

export type ProofVerifier = (proof: ProofInput) => Promise<boolean>;

const realVerifier: ProofVerifier = async (proof) => {
  try {
    return await verifyProof(proof as Parameters<typeof verifyProof>[0]);
  } catch {
    return false;
  }
};

export interface LedgerCommit {
  /** Code de la preuve pour cette chasse : une personne = un engagement. */
  nullifier: string;
  personalThreshold: number;
  at: number;
  txId: string;
}

export interface LedgerHunt extends Omit<HuntMessage, "t" | "proof"> {
  createdAt: number;
  txId: string;
  /** Code de la preuve de création : permet au créateur de se faire reconnaître. */
  creatorNullifier: string;
  commits: LedgerCommit[];
  activatedAt?: number;
  activationRank?: number;
}

export type LedgerStatus = "active" | "activated" | "expired";

export class Ledger {
  private readonly group = new Group();
  private readonly members = new Set<string>();
  private readonly roots: string[] = [];
  /** Invitations non utilisées : clé publique → expiration (Infinity : départ). */
  private readonly invitations = new Map<string, number>();
  private readonly usedSlots = new Set<string>();
  private readonly hunts = new Map<string, LedgerHunt>();
  private readonly seen = new Set<string>();

  constructor(
    private readonly genesis: Genesis,
    private readonly verify: ProofVerifier = realVerifier,
  ) {
    for (const key of genesis.invitationKeys) this.invitations.set(key, Infinity);
  }

  // --- Lecture -------------------------------------------------------------------

  memberCommitments(): string[] {
    return this.group.members.map(String);
  }

  knownRoots(): ReadonlySet<string> {
    return new Set(this.roots);
  }

  hunt(id: string): LedgerHunt | undefined {
    return this.hunts.get(id);
  }

  allHunts(): LedgerHunt[] {
    return [...this.hunts.values()];
  }

  retainedGroup(h: LedgerHunt): RetainedGroup {
    return computeRetainedGroup(
      h.commits.map((c) => c.personalThreshold),
      h.threshold,
    );
  }

  /** État à l'instant `now` : l'activation prime ; après la date limite, l'issue est connue. */
  status(h: LedgerHunt, now: number): { status: LedgerStatus; outcome?: "success" | "failure" } {
    const over = now > h.deadline;
    if (h.activatedAt !== undefined) {
      return over ? { status: "activated", outcome: "success" } : { status: "activated" };
    }
    return over ? { status: "expired", outcome: "failure" } : { status: "active" };
  }

  /** Rôle d'une personne dans une chasse, d'après le code de sa preuve. */
  roleOf(huntId: string, nullifier: string): "creator" | "participant" | undefined {
    const h = this.hunts.get(huntId);
    if (!h) return undefined;
    if (h.creatorNullifier === nullifier) return "creator";
    const mine = h.commits.find((c) => c.nullifier === nullifier);
    return mine && isRetained(mine.personalThreshold, this.retainedGroup(h))
      ? "participant"
      : undefined;
  }

  // --- Application des messages ------------------------------------------------

  async apply(e: ChainEvent): Promise<ApplyResult> {
    if (this.seen.has(e.txId)) return { ok: false, reason: "duplicate_tx" };
    this.seen.add(e.txId);
    const m = decodeMessage(e.payload);
    if (!m) return { ok: false, reason: "not_a_message" };
    switch (m.t) {
      case "invite":
        return this.applyInvite(m, e);
      case "pass":
        return this.applyPass(m, e);
      case "hunt":
        return this.applyHunt(m, e);
      case "commit":
        return this.applyCommit(m, e);
    }
  }

  private async proofOk(
    proof: ProofInput,
    scope: string,
    message: string | number,
  ): Promise<boolean> {
    if (!this.roots.includes(proof.merkleTreeRoot)) return false;
    if (proof.scope !== scopeField(scope)) return false;
    if (proof.message !== BigInt(message).toString()) return false;
    return this.verify(proof);
  }

  private async applyInvite(m: InviteMessage, e: ChainEvent): Promise<ApplyResult> {
    if (m.slot > this.genesis.invitesPerMonth) return { ok: false, reason: "invalid_slot" };
    if (this.invitations.has(m.key)) return { ok: false, reason: "key_exists" };
    // Mois de la preuve : celui du bloc, ou la veille (preuve faite juste avant minuit).
    const months = new Set([monthOf(e.time), monthOf(e.time - 86_400_000)]);
    const scope = [...months]
      .map((month) => inviteScope(month, m.slot))
      .find((s) => scopeField(s) === m.proof.scope);
    if (!scope) return { ok: false, reason: "invalid_scope" };
    const slotKey = `${scope}|${m.proof.nullifier}`;
    if (this.usedSlots.has(slotKey)) return { ok: false, reason: "slot_used" };
    if (!(await this.proofOk(m.proof, scope, inviteDigest(m.key)))) {
      return { ok: false, reason: "invalid_proof" };
    }
    this.usedSlots.add(slotKey);
    this.invitations.set(m.key, e.time + INVITATION_TTL_MS);
    return { ok: true, type: "invite" };
  }

  private applyPass(m: PassMessage, e: ChainEvent): ApplyResult {
    const expiresAt = this.invitations.get(m.key);
    if (expiresAt === undefined || expiresAt < e.time) {
      return { ok: false, reason: "invalid_invitation" };
    }
    if (!verifyRedeem(m)) return { ok: false, reason: "invalid_signature" };
    if (this.members.has(m.commitment)) return { ok: false, reason: "already_member" };
    this.invitations.delete(m.key);
    this.group.addMember(BigInt(m.commitment));
    this.members.add(m.commitment);
    this.roots.push(this.group.root.toString());
    if (this.roots.length > ROOT_HISTORY) this.roots.shift();
    return { ok: true, type: "pass" };
  }

  private async applyHunt(m: HuntMessage, e: ChainEvent): Promise<ApplyResult> {
    if (this.hunts.has(m.id)) return { ok: false, reason: "hunt_exists" };
    if (m.threshold < this.genesis.minThreshold) return { ok: false, reason: "threshold_too_low" };
    if (m.deposit < this.genesis.minCautionKas) return { ok: false, reason: "caution_too_low" };
    if (m.deadline <= e.time || m.deadline > e.time + MAX_DEADLINE_MS) {
      return { ok: false, reason: "invalid_deadline" };
    }
    const { t: _t, proof, ...content } = m;
    if (!(await this.proofOk(proof, createScope(m.id), huntDigest(content)))) {
      return { ok: false, reason: "invalid_proof" };
    }
    this.hunts.set(m.id, {
      ...content,
      createdAt: e.time,
      txId: e.txId,
      creatorNullifier: proof.nullifier,
      commits: [],
    });
    return { ok: true, type: "hunt" };
  }

  private async applyCommit(m: CommitMessage, e: ChainEvent): Promise<ApplyResult> {
    const h = this.hunts.get(m.hunt);
    if (!h) return { ok: false, reason: "unknown_hunt" };
    // Engagements ouverts jusqu'à la date limite, même après l'activation.
    if (e.time > h.deadline) return { ok: false, reason: "closed" };
    const t = Number(m.proof.message);
    if (!Number.isSafeInteger(t) || t < h.threshold || t > MAX_PERSONAL_THRESHOLD) {
      return { ok: false, reason: "invalid_threshold" };
    }
    if (h.commits.some((c) => c.nullifier === m.proof.nullifier)) {
      return { ok: false, reason: "already_committed" };
    }
    if (!(await this.proofOk(m.proof, huntScope(h.id), t))) {
      return { ok: false, reason: "invalid_proof" };
    }
    h.commits.push({
      nullifier: m.proof.nullifier,
      personalThreshold: t,
      at: e.time,
      txId: e.txId,
    });
    if (h.activatedAt === undefined && this.retainedGroup(h).retainedThreshold !== null) {
      h.activatedAt = e.time;
      h.activationRank = h.commits.length;
    }
    return { ok: true, type: "commit" };
  }
}
