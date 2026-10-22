// L'index du registre, tournant dans ce navigateur (aucun serveur Huntited).
// Il lit l'API publique du réseau de test (VITE_KASPA_API_URL), ne lui
// transmet que l'adresse publique du registre, et produit les mêmes vues que
// l'index du serveur (backend/src/routes/chain.ts).
import { REGISTRY_ADDRESS } from "../chain";
import { minHuntThreshold } from "../validation";
import { OFFICIAL_ARCHIVE_SIGNER, archiveSignedBy } from "./archive-signature";
import { ChainIndexer, parseArchive, restSource } from "./indexer";
import { Ledger, type LedgerHidden, type LedgerHunt, type LedgerRelease } from "./ledger";
import { DEFAULT_GENESIS, type HideReason } from "./protocol";
import { OFFICIAL_PUBLISHER } from "./publisher";

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

/**
 * Archives du registre (VITE_CHAIN_ARCHIVES, plusieurs séparées par des
 * virgules) : elles gardent les transactions que l'API publique a oubliées.
 * Version statique : l'archive livrée avec le site, puis l'archive tenue à
 * jour en ligne (docs/archives.md).
 */
export function chainArchiveUrls(): string[] {
  const raw = (import.meta.env["VITE_CHAIN_ARCHIVES"] as string | undefined) ?? "";
  return raw
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
}

/**
 * Adresses autorisées à ancrer une version du site (identiques pour tous les
 * index) : par défaut, la clé qui possède huntited.kas (voir publisher.ts).
 */
export function releasePublishers(): string[] {
  const env = import.meta.env["VITE_RELEASE_PUBLISHERS"] as string | undefined;
  return (env || OFFICIAL_PUBLISHER)
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
  /** Masquée sur le site par la clé de publication (modération), avec la raison. */
  hidden?: HideReason;
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
let archives: Promise<void> | null = null;

/** Clés d'archivage acceptées (VITE_ARCHIVE_SIGNERS ; par défaut, la clé officielle). */
export function archiveSigners(): string[] {
  const env = import.meta.env["VITE_ARCHIVE_SIGNERS"] as string | undefined;
  return (env || OFFICIAL_ARCHIVE_SIGNER)
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}

/**
 * Charge chaque archive une fois ; une archive absente ou illisible est
 * ignorée. Seule l'archive livrée avec le site (adresse relative, couverte
 * par l'ancrage) est acceptée sans signature ; les autres doivent être
 * signées par une clé d'archivage autorisée.
 */
async function loadArchives(idx: ChainIndexer): Promise<void> {
  await Promise.all(
    chainArchiveUrls().map(async (url) => {
      try {
        const res = await fetch(url, { cache: "no-cache" });
        if (!res.ok) return;
        const data: unknown = await res.json();
        // Adresse relative = fichier du site lui-même (couvert par l'ancrage).
        const shipped = !url.includes(":");
        if (!shipped && !archiveSignedBy(data, archiveSigners())) return;
        await idx.seed(parseArchive(data, REGISTRY_ADDRESS));
      } catch {
        /* archive indisponible : l'API et les autres archives suffisent */
      }
    }),
  );
}

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
  archives ??= loadArchives(idx);
  await archives;
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
  // Chasses masquées (modération) : absentes des listes.
  return ledger
    .allHunts()
    .filter((h) => !ledger.hidden(h.id))
    .map((h) => viewOf(ledger, h, now));
}

export async function getChainHunt(id: string, now = Date.now()): Promise<ChainHuntView | null> {
  const ledger = await synced();
  const h = ledger.hunt(id);
  if (!h) return null;
  const hidden = ledger.hidden(id);
  return { ...viewOf(ledger, h, now), ...(hidden ? { hidden: hidden.reason } : {}) };
}

/** Chasses masquées par la modération (page « Versions et modération »). */
export async function getChainHidden(): Promise<LedgerHidden[]> {
  return (await synced()).hiddenHunts();
}

/**
 * Membres du chat chiffré d'une chasse (clés publiques de chat inscrites sur
 * la chaîne : créateur puis engagements, dans l'ordre). Seulement une fois la
 * chasse déclenchée ; null sinon. Aucune adresse n'est renvoyée.
 */
export async function getChainChat(
  id: string,
): Promise<{ members: string[]; creator?: string; deadline: number; title: string } | null> {
  const h = (await synced()).hunt(id);
  if (!h || h.activatedAt === undefined) return null;
  const members = [h.chat, ...h.commits.map((c) => c.chat)].filter(
    (k): k is string => typeof k === "string",
  );
  return {
    members: [...new Set(members)],
    ...(h.chat ? { creator: h.chat } : {}),
    deadline: h.deadline,
    title: h.title,
  };
}

/** Versions officielles du site ancrées sur la chaîne. */
export async function getChainReleases(): Promise<LedgerRelease[]> {
  return (await synced()).releases();
}

/** Tests : repartir d'un index vide. */
export function resetBrowserIndex(): void {
  indexer = null;
  lastSync = 0;
  archives = null;
}
