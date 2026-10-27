// Accès unique aux chasses, selon VITE_DATA_MODE :
//   "local" → démos + chasses de ce navigateur (localStorage) — par défaut ;
//   "api"   → registre partagé du backend (plusieurs appareils, plusieurs
//             personnes) ; créer et s'engager exigent la session signée ;
//   "chain" → registre sur la blockchain (réseau de test) : lecture par un
//             index, écriture par une transaction Kastle (docs/registre-kaspa.md).
// Les écrans ne dépendent que de cette interface.
import { ApiError, apiFetch, getSessionToken } from "./api-client";
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
import { getPassConfig, hasPass, proveWithPass } from "./pass";
import { isRetained } from "./retained-group";
import type { Hunt, HuntFormData, HuntStatus, ProgressVisibility } from "./types";
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
import { getChainHunt, listChainHunts } from "./onchain/browser-index";
import { ensureChatKey } from "./p2p-chat";

export type DataMode = "local" | "api" | "chain";

export function getDataMode(): DataMode {
  const mode = import.meta.env["VITE_DATA_MODE"];
  return mode === "api" || mode === "chain" ? mode : "local";
}

/** Chemin de lecture des chasses : registre du serveur, ou index de la chaîne. */
const huntsPath = () => (getDataMode() === "chain" ? "/api/chain/hunts" : "/api/hunts");

/**
 * Mode chaîne : l'index tourne dans le navigateur (aucun serveur), sauf si
 * VITE_CHAIN_INDEX=server (index du backend, /api/chain).
 */
const browserIndex = () =>
  getDataMode() === "chain" && import.meta.env["VITE_CHAIN_INDEX"] !== "server";

/** Une chasse et son état courant. */
export interface HuntView {
  hunt: Hunt;
  status: HuntStatus;
  /** null quand le serveur masque le compteur (progression masquée, phase active). */
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

// --- Mode API -----------------------------------------------------------------

interface PublicHunt {
  hidden?: string;
  id: string;
  title: string;
  description: string;
  location: string;
  deadline: string;
  threshold: number;
  /** Caution du créateur, en KAS (absente des anciennes chasses : 30). */
  deposit?: number;
  /** Pays (code ISO) ; absent pour les anciennes chasses. */
  country?: string;
  progressVisibility: ProgressVisibility;
  status: "active" | "activated" | "expired" | "settled";
  commitCount: number | null;
  retainedCount: number | null;
  retainedThreshold: number | null;
  activationRank?: number;
  commitsOpen: boolean;
  outcome?: SettlementOutcome;
  activatedAt?: string;
  settledAt?: string;
  /** Registre sur la chaîne : date limite passée, échec pas encore confirmé. */
  outcomePending?: boolean;
}

function apiView(p: PublicHunt): HuntView {
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

const actionError = (e: unknown, fallback: MessageKey) =>
  new HuntActionError(
    e instanceof ApiError && e.reason === "signature_refused"
      ? translate(getLocale(), "err.signature")
      : e instanceof ApiError && e.reason === "unavailable"
        ? translate(getLocale(), "err.unavailable")
        : e instanceof ApiError && e.message !== e.reason
          ? e.message
          : translate(getLocale(), fallback),
  );

// --- Interface publique ---------------------------------------------------------

export async function listHuntViews(): Promise<HuntView[]> {
  if (getDataMode() === "local") return listHunts().map((h) => localView(h));
  if (browserIndex()) return (await listChainHunts()).map(apiView);
  const list = await apiFetch<PublicHunt[]>("GET", huntsPath());
  return (Array.isArray(list) ? list : []).map(apiView);
}

/** Chasse envoyée sur la chaîne mais pas encore indexée : affichage provisoire. */
function pendingView(m: ChainHuntMessage): HuntView {
  const view = apiView({
    ...m,
    deadline: new Date(m.deadline).toISOString(),
    status: "active",
    commitCount: 0,
    retainedCount: 0,
    retainedThreshold: null,
    commitsOpen: false,
  });
  return { ...view, pending: true };
}

export async function getHuntView(id: string): Promise<HuntView | undefined> {
  if (getDataMode() === "local") {
    const h = getHunt(id);
    return h ? localView(h) : undefined;
  }
  if (browserIndex()) {
    const found = await getChainHunt(id);
    if (found) {
      forgetPendingHunt(id);
      return apiView(found);
    }
    const pending = getPendingHunt(id);
    return pending ? pendingView(pending) : undefined;
  }
  try {
    const view = apiView(
      await apiFetch<PublicHunt>("GET", `${huntsPath()}/${encodeURIComponent(id)}`),
    );
    forgetPendingHunt(id);
    return view;
  } catch (e) {
    if (e instanceof ApiError && e.reason === "not_found") {
      const pending = getDataMode() === "chain" ? getPendingHunt(id) : undefined;
      return pending ? pendingView(pending) : undefined;
    }
    throw e;
  }
}

/** Mode chaîne : envoie le message par Kastle (erreurs du wallet affichées telles quelles). */
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
  if (getDataMode() === "chain") {
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
      progressVisibility: data.progressVisibility ?? "visible",
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
  try {
    const token = await getSessionToken(address);
    const created = await apiFetch<PublicHunt>(
      "POST",
      "/api/hunts",
      {
        title: data.title.trim(),
        description: data.description.trim(),
        location: data.location.trim(),
        ...(data.country ? { country: data.country } : {}),
        deadline: new Date(data.deadline).toISOString(),
        threshold: data.threshold,
        deposit: data.deposit,
        progressVisibility: data.progressVisibility ?? "visible",
      },
      token,
    );
    notify();
    return created.id;
  } catch (e) {
    throw actionError(e, "err.create");
  }
}

/** true si ce wallet est (connu comme) engagé dans la chasse. */
export function isCommitted(huntId: string, address: string): boolean {
  return getDataMode() === "local"
    ? hasMockCommitment(huntId, address)
    : getMyCommitment(address, huntId) !== undefined;
}

/**
 * Mode local : true / false selon que ce wallet fait partie du groupe retenu.
 * Mode registre : undefined (c'est le serveur qui décide, via le jeton de chat).
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
  if (getDataMode() === "chain") {
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
    return;
  }
  // Pass exigé : preuve anonyme « une personne = un engagement », calculée
  // sur l'appareil, avec le seuil personnel scellé dedans.
  const { required } = await getPassConfig();
  if (required && !hasPass()) {
    throw new Error(translate(getLocale(), "err.needPass"));
  }
  try {
    const token = await getSessionToken(address);
    const proof = required
      ? await proveWithPass(`hunt:${huntId}`, personalThreshold ?? 0)
      : undefined;
    // Rang null : chasse à progression masquée encore active (révélé plus tard).
    const r = await apiFetch<{ rank: number | null; hunt: PublicHunt }>(
      "POST",
      `/api/hunts/${encodeURIComponent(huntId)}/commit`,
      {
        ...(personalThreshold === undefined ? {} : { personalThreshold }),
        ...(proof ? { proof } : {}),
      },
      token,
    );
    rememberCommitment(address, huntId, {
      committedAt: Date.now(),
      personalThreshold: personalThreshold ?? r.hunt.threshold,
      ...(r.rank !== null ? { rank: r.rank } : {}),
    });
    notify();
  } catch (e) {
    // Déjà engagé·e (autre appareil, cache vidé) : on s'en souvient localement.
    if (e instanceof ApiError && e.code === "already_committed") {
      rememberCommitment(address, huntId, { committedAt: Date.now() });
      notify();
    }
    throw actionError(e, "err.commit");
  }
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

export interface SyncResult {
  created: number;
  commitments: number;
}

/**
 * Mode registre : récupère l'activité du wallet sur le serveur (chasses
 * créées, engagements et rangs révélés) pour retrouver « Mes chasses » et les
 * badges sur cet appareil. Demande une signature si aucune session n'est ouverte.
 */
export async function syncMyActivity(address: string): Promise<SyncResult> {
  // Mode chaîne : pas encore de synchronisation (l'index ne renvoie aucune adresse).
  if (getDataMode() !== "api") return { created: 0, commitments: 0 };
  try {
    const token = await getSessionToken(address);
    const me = await apiFetch<{
      created: PublicHunt[];
      commitments: {
        hunt: PublicHunt;
        rank: number | null;
        committedAt: string;
        personalThreshold?: number;
      }[];
    }>("GET", "/api/me", undefined, token);
    for (const h of me.created) {
      addUserHunt(address, {
        huntId: h.id,
        title: h.title,
        location: h.location,
        deadline: h.deadline,
        threshold: h.threshold,
      });
    }
    for (const c of me.commitments) {
      rememberCommitment(address, c.hunt.id, {
        committedAt: Date.parse(c.committedAt) || Date.now(),
        ...(c.personalThreshold !== undefined ? { personalThreshold: c.personalThreshold } : {}),
        ...(c.rank !== null ? { rank: c.rank } : {}),
      });
    }
    notify();
    return { created: me.created.length, commitments: me.commitments.length };
  } catch (e) {
    throw actionError(e, "err.sync");
  }
}

/** Résolution simulée (développement uniquement) : aucun KAS transféré. */
export async function settleHunt(huntId: string, outcome: SettlementOutcome): Promise<void> {
  if (getDataMode() === "local") {
    markHuntSettled(huntId, outcome);
    return;
  }
  // Mode chaîne : l'issue se calcule seule à la date limite.
  if (getDataMode() === "chain") return;
  await apiFetch("POST", `/api/hunts/${encodeURIComponent(huntId)}/settle`, {});
  notify();
}
