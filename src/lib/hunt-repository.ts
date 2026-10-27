// Accès unique aux chasses, selon VITE_DATA_MODE :
//   "local" → démos + chasses de ce navigateur (localStorage) — par défaut ;
//   "chain" → registre sur la blockchain (réseau de test) : lecture par
//             l'index du navigateur, écriture par une transaction du wallet
//             (docs/registre-kaspa.md). C'est le mode du site en ligne.
// Les écrans ne dépendent que de cette interface.
import {
  COMMIT_DEPOSIT_KAS,
  CREATE_DEPOSIT_KAS,
  commitToHunt as localCommit,
  commitsOpen as localCommitsOpen,
  createHuntCovenant,
  getCommitCount,
  getHunt,
  getRetainedGroup,
  listHunts,
  onCommitmentsChange,
} from "./covenants";
import { deriveHuntStatus } from "./hunt-lifecycle";
import {
  deriveAndPersistHuntState,
  markHuntSettled,
  subscribeHuntState,
  type SettlementOutcome,
} from "./hunt-state-store";
import { getMockPersonalThreshold, hasMockCommitment } from "./mock-zk";
import { forgetCommitment, getMyCommitment, rememberCommitment } from "./my-commitments";
import { getLocale, translate, type MessageKey } from "./i18n";
import { isRetained } from "./retained-group";
import type { Hunt, HuntFormData, HuntStatus } from "./types";
import { addUserHunt } from "./user-hunts";
import {
  addPendingHunt,
  forgetPendingHunt,
  getPendingHunt,
  newHuntId,
  publish,
  type ChainHuntMessage,
  type ChainMessage,
} from "./chain";
import { WalletError } from "./wallet";
import { getChainHunt, listChainHunts, type ChainHuntView } from "./onchain/browser-index";
import { ensureChatKey } from "./p2p-chat";

export type DataMode = "local" | "chain";

export function getDataMode(): DataMode {
  return import.meta.env["VITE_DATA_MODE"] === "chain" ? "chain" : "local";
}

/** Une chasse et son état courant. */
export interface HuntView {
  hunt: Hunt;
  status: HuntStatus;
  /** null quand le compteur est masqué (progression masquée, phase active). */
  commitCount: number | null;
  /** Taille du groupe retenu (seuils personnels) ; null si masquée. */
  retainedCount: number | null;
  /** Seuil personnel maximal satisfait (k*) ; null sans groupe ou si masqué. */
  retainedThreshold: number | null;
  /** Engagement qui a déclenché l'activation, s'il est connu. */
  activationRank?: number;
  /** Engagements encore acceptés (active, ou activée avant la date limite). */
  commitsOpen: boolean;
  outcome?: SettlementOutcome;
  /** Mode chaîne : chasse envoyée, pas encore vue par l'index (≈ 1 min). */
  pending?: boolean;
  /** Mode chaîne : date limite passée, résultat encore en vérification. */
  outcomePending?: boolean;
  /** Mode chaîne : masquée par la modération (raison). */
  hidden?: string;
}

export class HuntActionError extends Error {}

// --- Changements (rafraîchissement des écrans) ---------------------------------

const CHANGE_EVENT = "huntited:registry-changed";
const notify = () => {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CHANGE_EVENT));
};

export function onHuntsChange(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CHANGE_EVENT, listener);
  const unsubs = [onCommitmentsChange(listener), subscribeHuntState(listener)];
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    unsubs.forEach((u) => u());
  };
}

// --- Mode local ---------------------------------------------------------------

function localView(base: Hunt, now = Date.now()): HuntView {
  const count = getCommitCount(base);
  const group = getRetainedGroup(base);
  // L'activation se fonde sur le groupe retenu (seuils personnels).
  const stored = deriveAndPersistHuntState(base, group.retainedCount, now, count);
  const hunt: Hunt = {
    ...base,
    ...(stored.activatedAt ? { activatedAt: stored.activatedAt } : {}),
    ...(stored.settledAt ? { settledAt: stored.settledAt } : {}),
  };
  return {
    hunt,
    status: deriveHuntStatus(base, group.retainedCount, now, stored),
    commitCount: count,
    retainedCount: group.retainedCount,
    retainedThreshold: group.retainedThreshold,
    commitsOpen: localCommitsOpen(base, now),
    ...(stored.activationRank !== undefined ? { activationRank: stored.activationRank } : {}),
    ...(stored.settlementOutcome ? { outcome: stored.settlementOutcome } : {}),
  };
}

// --- Mode chaîne --------------------------------------------------------------

function chainView(p: ChainHuntView): HuntView {
  return {
    hunt: {
      id: p.id,
      title: p.title,
      description: p.description,
      location: p.location,
      ...(p.country ? { country: p.country } : {}),
      deadline: p.deadline,
      threshold: p.threshold,
      deposit: p.deposit ?? CREATE_DEPOSIT_KAS,
      commitDeposit: COMMIT_DEPOSIT_KAS,
      commitCount: p.commitCount ?? 0,
      status: p.status,
      progressVisibility: p.progressVisibility,
      ...(p.activatedAt ? { activatedAt: p.activatedAt } : {}),
      ...(p.settledAt ? { settledAt: p.settledAt } : {}),
    },
    status: p.status,
    commitCount: p.commitCount,
    retainedCount: p.retainedCount ?? null,
    retainedThreshold: p.retainedThreshold ?? null,
    commitsOpen: p.commitsOpen ?? p.status === "active",
    ...(p.activationRank !== undefined ? { activationRank: p.activationRank } : {}),
    ...(p.outcome ? { outcome: p.outcome } : {}),
    ...(p.outcomePending ? { outcomePending: true } : {}),
    ...(p.hidden ? { hidden: p.hidden } : {}),
  };
}

/** Chasse envoyée sur la chaîne mais pas encore indexée : affichage provisoire. */
function pendingView(m: ChainHuntMessage): HuntView {
  const view = chainView({
    ...m,
    deadline: new Date(m.deadline).toISOString(),
    status: "active",
    commitCount: 0,
    retainedCount: 0,
    retainedThreshold: null,
    commitsOpen: false,
    createdAt: new Date().toISOString(),
  });
  return { ...view, pending: true };
}

// --- Interface publique ---------------------------------------------------------

export async function listHuntViews(): Promise<HuntView[]> {
  if (getDataMode() === "local") return listHunts().map((h) => localView(h));
  return (await listChainHunts()).map(chainView);
}

export async function getHuntView(id: string): Promise<HuntView | undefined> {
  if (getDataMode() === "local") {
    const h = getHunt(id);
    return h ? localView(h) : undefined;
  }
  const found = await getChainHunt(id);
  if (found) {
    forgetPendingHunt(id);
    return chainView(found);
  }
  const pending = getPendingHunt(id);
  return pending ? pendingView(pending) : undefined;
}

/** Mode chaîne : envoie le message par le wallet (ses erreurs sont affichées telles quelles). */
async function publishOrThrow(m: ChainMessage, fallback: MessageKey): Promise<void> {
  try {
    await publish(m);
  } catch (e) {
    throw new HuntActionError(
      e instanceof WalletError ? e.message : translate(getLocale(), fallback),
    );
  }
}

/** Crée une chasse ; renvoie son identifiant. */
export async function createHunt(data: HuntFormData, address: string): Promise<string> {
  if (getDataMode() === "local") return (await createHuntCovenant(data)).huntId;
  const id = newHuntId();
  // Clé de chat (chat chiffré entre membres, à l'ouverture de la chasse).
  const chat = ensureChatKey(id);
  const hunt: ChainHuntMessage = {
    t: "hunt",
    id,
    title: data.title.trim(),
    description: data.description.trim(),
    location: data.location.trim(),
    ...(data.country ? { country: data.country } : {}),
    deadline: new Date(data.deadline).getTime(),
    threshold: data.threshold,
    deposit: data.deposit,
    progressVisibility: data.progressVisibility ?? "hidden",
    ...(chat ? { chat } : {}),
  };
  await publishOrThrow(hunt, "err.create");
  addPendingHunt(hunt);
  addUserHunt(address, {
    huntId: hunt.id,
    title: hunt.title,
    location: hunt.location,
    deadline: new Date(hunt.deadline).toISOString(),
    threshold: hunt.threshold,
  });
  notify();
  return hunt.id;
}

/** true si ce wallet est (connu comme) engagé dans la chasse. */
export function isCommitted(huntId: string, address: string): boolean {
  return getDataMode() === "local"
    ? hasMockCommitment(huntId, address)
    : getMyCommitment(address, huntId) !== undefined;
}

/**
 * Mode local : true / false selon que ce wallet fait partie du groupe retenu.
 * Mode chaîne : undefined (non connu sur cet appareil).
 */
export function isRetainedHere(huntId: string, address: string): boolean | undefined {
  if (getDataMode() !== "local") return undefined;
  const hunt = getHunt(huntId);
  if (!hunt) return false;
  const mine = getMockPersonalThreshold(huntId, address, hunt.threshold);
  return mine !== undefined && isRetained(mine, getRetainedGroup(hunt));
}

/** Seuil personnel de ce wallet dans la chasse, s'il est connu sur cet appareil. */
export function getMyPersonalThreshold(hunt: Hunt, address: string): number | undefined {
  return getDataMode() === "local"
    ? getMockPersonalThreshold(hunt.id, address, hunt.threshold)
    : getMyCommitment(address, hunt.id)?.personalThreshold;
}

/**
 * Engage le wallet (5 KAS simulés), avec un seuil personnel facultatif :
 * « je viens si au moins N personnes viennent » (N ≥ seuil de la chasse).
 */
export async function commit(
  huntId: string,
  address: string,
  personalThreshold?: number,
  /** Mode chaîne : ne compte que si cette autre chasse se déclenche (chasses enchaînées). */
  after?: string,
): Promise<void> {
  if (getDataMode() === "local") {
    await localCommit(huntId, address, personalThreshold);
    return;
  }
  // Un wallet = un engagement : l'index refuserait le second (et 0,2 KAS perdus).
  if (getMyCommitment(address, huntId)) {
    throw new HuntActionError(translate(getLocale(), "err.alreadyCommitted"));
  }
  const chat = ensureChatKey(huntId);
  await publishOrThrow(
    {
      t: "commit",
      hunt: huntId,
      ...(personalThreshold === undefined ? {} : { threshold: personalThreshold }),
      ...(chat ? { chat } : {}),
      ...(after ? { after } : {}),
    },
    "err.commit",
  );
  rememberCommitment(address, huntId, {
    committedAt: Date.now(),
    ...(personalThreshold === undefined ? {} : { personalThreshold }),
    ...(after ? { after } : {}),
  });
  notify();
}

/**
 * Retire l'engagement de ce wallet (mode chaîne), tant que la chasse n'est
 * pas déclenchée : on peut changer d'avis jusqu'au dernier moment.
 */
export async function withdraw(huntId: string, address: string): Promise<void> {
  if (getDataMode() !== "chain") {
    throw new HuntActionError(translate(getLocale(), "err.withdrawUnavailable"));
  }
  await publishOrThrow({ t: "withdraw", hunt: huntId }, "err.withdraw");
  forgetCommitment(address, huntId);
  notify();
}

/** Chasses dans lesquelles ce wallet est (connu comme) engagé. */
export async function listMyEngagements(address: string): Promise<HuntView[]> {
  const views = await listHuntViews();
  return views.filter((v) => isCommitted(v.hunt.id, address));
}

/** Résolution simulée (mode local, développement) : aucun KAS transféré. */
export async function settleHunt(huntId: string, outcome: SettlementOutcome): Promise<void> {
  // Mode chaîne : l'issue se calcule seule à la date limite.
  if (getDataMode() !== "local") return;
  markHuntSettled(huntId, outcome);
}
