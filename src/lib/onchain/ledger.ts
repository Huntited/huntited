// Grand livre du registre, côté navigateur : rejoue les messages lus sur la
// chaîne, dans l'ordre, et en déduit l'état des chasses (et des pass).
// ⚠️ Copie conforme de backend/src/chain/ledger.ts, vérifiée par
// src/lib/onchain/conformance.test.ts.
// Différence technique seulement : le groupe et la vérification des preuves de
// pass (en réserve, rares) sont chargés à la demande, pour ne pas alourdir le site.
import { computeRetainedGroup, isRetained, type RetainedGroup } from "../retained-group";
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
  type ProofInput,
} from "./protocol";

export interface ChainEvent {
  txId: string;
  time: number;
  sender: string;
  payload: Uint8Array;
}

export const byAddress = (address: string) => `a:${address}`;
export const byPass = (nullifier: string) => `p:${nullifier}`;

export type ApplyResult =
  { ok: true; type: "invite" | "pass" | "hunt" | "commit" } | { ok: false; reason: string };

export type ProofVerifier = (proof: ProofInput) => Promise<boolean>;

const realVerifier: ProofVerifier = async (proof) => {
  try {
    const { verifyProof } = await import("@semaphore-protocol/core");
    return await verifyProof(proof as Parameters<typeof verifyProof>[0]);
  } catch {
    return false;
  }
};

export interface LedgerCommit {
  who: string;
  personalThreshold: number;
  at: number;
  txId: string;
}

export interface LedgerHunt extends Omit<HuntMessage, "t" | "proof"> {
  createdAt: number;
  txId: string;
  creator: string;
  commits: LedgerCommit[];
  activatedAt?: number;
  activationRank?: number;
}

export type LedgerStatus = "active" | "activated" | "expired";

type SemaphoreGroup = InstanceType<typeof import("@semaphore-protocol/core").Group>;

export class Ledger {
  private group: SemaphoreGroup | null = null;
  private readonly members: string[] = [];
  private readonly memberSet = new Set<string>();
  private readonly roots: string[] = [];
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

  memberCommitments(): string[] {
    return [...this.members];
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

  status(h: LedgerHunt, now: number): { status: LedgerStatus; outcome?: "success" | "failure" } {
    const over = now > h.deadline;
    if (h.activatedAt !== undefined) {
      return over ? { status: "activated", outcome: "success" } : { status: "activated" };
    }
    return over ? { status: "expired", outcome: "failure" } : { status: "active" };
  }

  roleOf(huntId: string, who: string): "creator" | "participant" | undefined {
    const h = this.hunts.get(huntId);
    if (!h) return undefined;
    if (h.creator === who) return "creator";
    const mine = h.commits.find((c) => c.who === who);
    return mine && isRetained(mine.personalThreshold, this.retainedGroup(h))
      ? "participant"
      : undefined;
  }

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

  private async applyPass(m: PassMessage, e: ChainEvent): Promise<ApplyResult> {
    const expiresAt = this.invitations.get(m.key);
    if (expiresAt === undefined || expiresAt < e.time) {
      return { ok: false, reason: "invalid_invitation" };
    }
    if (!verifyRedeem(m)) return { ok: false, reason: "invalid_signature" };
    if (this.memberSet.has(m.commitment)) return { ok: false, reason: "already_member" };
    this.invitations.delete(m.key);
    if (!this.group) {
      const { Group } = await import("@semaphore-protocol/core");
      this.group = new Group();
    }
    this.group.addMember(BigInt(m.commitment));
    this.members.push(m.commitment);
    this.memberSet.add(m.commitment);
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
    let creator = byAddress(e.sender);
    if (proof) {
      if (!(await this.proofOk(proof, createScope(m.id), huntDigest(content)))) {
        return { ok: false, reason: "invalid_proof" };
      }
      creator = byPass(proof.nullifier);
    } else if (this.genesis.passRequired) {
      return { ok: false, reason: "pass_required" };
    }
    this.hunts.set(m.id, { ...content, createdAt: e.time, txId: e.txId, creator, commits: [] });
    return { ok: true, type: "hunt" };
  }

  private async applyCommit(m: CommitMessage, e: ChainEvent): Promise<ApplyResult> {
    const h = this.hunts.get(m.hunt);
    if (!h) return { ok: false, reason: "unknown_hunt" };
    if (e.time > h.deadline) return { ok: false, reason: "closed" };
    if (!m.proof && this.genesis.passRequired) return { ok: false, reason: "pass_required" };
    const t = m.proof ? Number(m.proof.message) : (m.threshold ?? h.threshold);
    if (!Number.isSafeInteger(t) || t < h.threshold || t > MAX_PERSONAL_THRESHOLD) {
      return { ok: false, reason: "invalid_threshold" };
    }
    const who = m.proof ? byPass(m.proof.nullifier) : byAddress(e.sender);
    if (h.commits.some((c) => c.who === who)) return { ok: false, reason: "already_committed" };
    if (m.proof && !(await this.proofOk(m.proof, huntScope(h.id), t))) {
      return { ok: false, reason: "invalid_proof" };
    }
    h.commits.push({ who, personalThreshold: t, at: e.time, txId: e.txId });
    if (h.activatedAt === undefined && this.retainedGroup(h).retainedThreshold !== null) {
      h.activatedAt = e.time;
      h.activationRank = h.commits.length;
    }
    return { ok: true, type: "commit" };
  }
}
