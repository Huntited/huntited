// L'index du registre, tournant dans ce navigateur (aucun serveur Huntited).
// Il lit l'API publique du réseau de test (VITE_KASPA_API_URL), ne lui
// transmet que l'adresse publique du registre, et produit les mêmes vues que
// l'index du serveur (backend/src/routes/chain.ts).
import { REGISTRY_ADDRESS } from "../chain";
import { minHuntThreshold } from "../validation";
import { ChainIndexer, restSource } from "./indexer";
import { Ledger, type LedgerHunt, type LedgerRelease } from "./ledger";
import { DEFAULT_GENESIS } from "./protocol";

/** Délai avant d'annoncer un échec (retard possible de l'API publique). */
export const OUTCOME_GRACE_MS = 15 * 60_000;
/** Une lecture au plus toutes les 10 s, quel que soit le nombre d'écrans. */
const MIN_SYNC_INTERVAL_MS = 10_000;

/**
 * Points d'accès à l'API publique du réseau de test (VITE_KASPA_API_URL,
 * plusieurs séparés par des virgules) : un au hasard, les autres en secours.
 */
export function kaspaApiUrls(): string[] {
  const raw =
    (import.meta.env["VITE_KASPA_API_URL"] as string | undefined) ?? "https://api-tn10.kaspa.org";
  return raw
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
}

/** Adresses autorisées à ancrer une version du site (identiques pour tous les index). */
export function releasePublishers(): string[] {
  return ((import.meta.env["VITE_RELEASE_PUBLISHERS"] as string | undefined) ?? "")
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);
}

/** Vue publique d'une chasse (même forme que l'API du serveur). */
export interface ChainHuntView {
  id: string;
  title: string;
  description: string;
  location: string;
  country?: string;
  deadline: string;
  threshold: number;
  deposit: number;
  progressVisibility: "visible" | "hidden";
  status: "active" | "activated" | "expired" | "settled";
  commitCount: number | null;
  retainedCount: number | null;
  retainedThreshold: number | null;
  commitsOpen: boolean;
  createdAt: string;
  activationRank?: number;
  outcome?: "success" | "failure";
  activatedAt?: string;
  settledAt?: string;
  outcomePending?: boolean;
}

export function viewOf(ledger: Ledger, h: LedgerHunt, t: number): ChainHuntView {
  const computed = ledger.status(h, t);
  const outcomePending = computed.outcome === "failure" && t <= h.deadline + OUTCOME_GRACE_MS;
  const { status, outcome } = outcomePending ? { status: "active" as const } : computed;
  const masked = h.progressVisibility === "hidden" && status === "active";
  const group = ledger.retainedGroup(h);
  return {
    id: h.id,
    title: h.title,
    description: h.description,
    location: h.location,
    ...(h.country ? { country: h.country } : {}),
    deadline: new Date(h.deadline).toISOString(),
    threshold: h.threshold,
    deposit: h.deposit,
    progressVisibility: h.progressVisibility,
    status: outcome ? "settled" : status,
    commitCount: masked ? null : h.commits.length,
    retainedCount: masked ? null : group.retainedCount,
    retainedThreshold: masked ? null : group.retainedThreshold,
    commitsOpen: t <= h.deadline,
    createdAt: new Date(h.createdAt).toISOString(),
    ...(h.activationRank !== undefined && !masked ? { activationRank: h.activationRank } : {}),
    ...(outcome ? { outcome, settledAt: new Date(h.deadline).toISOString() } : {}),
    ...(h.activatedAt !== undefined ? { activatedAt: new Date(h.activatedAt).toISOString() } : {}),
    ...(outcomePending ? { outcomePending: true } : {}),
  };
}

let indexer: ChainIndexer | null = null;
let lastSync = 0;

function getIndexer(): ChainIndexer {
  indexer ??= new ChainIndexer(
    restSource(kaspaApiUrls()),
    REGISTRY_ADDRESS,
    () =>
      new Ledger({
        ...DEFAULT_GENESIS,
        invitationKeys: [],
        // Identique pour tous les index : 7 (abaissable en développement seulement).
        minThreshold: minHuntThreshold(),
        releaseAddresses: releasePublishers(),
      }),
  );
  return indexer;
}

/** Index à jour (une lecture du réseau au plus toutes les 10 s). */
async function synced(): Promise<Ledger> {
  const idx = getIndexer();
  if (Date.now() - lastSync >= MIN_SYNC_INTERVAL_MS) {
    lastSync = Date.now();
    try {
      await idx.sync();
    } catch (e) {
      lastSync = 0; // nouvel essai au prochain appel
      // Rien n'a jamais été lu : on signale l'indisponibilité.
      if (idx.ledger.allHunts().length === 0) throw e;
    }
  }
  return idx.ledger;
}

export async function listChainHunts(now = Date.now()): Promise<ChainHuntView[]> {
  const ledger = await synced();
  return ledger.allHunts().map((h) => viewOf(ledger, h, now));
}

export async function getChainHunt(id: string, now = Date.now()): Promise<ChainHuntView | null> {
  const ledger = await synced();
  const h = ledger.hunt(id);
  return h ? viewOf(ledger, h, now) : null;
}

/** Versions officielles du site ancrées sur la chaîne. */
export async function getChainReleases(): Promise<LedgerRelease[]> {
  return (await synced()).releases();
}

/** Tests : repartir d'un index vide. */
export function resetBrowserIndex(): void {
  indexer = null;
  lastSync = 0;
}
