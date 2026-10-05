// Collecte de l'activité d'un wallet pour le calcul des badges (mock local).
// Plus tard : lecture de l'état on-chain / indexeur, seule cette couche changera.
import { getBadgeVisibility, getSharedHuntIds } from "./badge-store";
import { computeBadges, type EarnedBadge, type HuntResult, type WalletActivity } from "./badges";
import { getCommitCount, getHunt, listHunts } from "./covenants";
import { deriveHuntStatus } from "./hunt-lifecycle";
import { getStoredHuntState } from "./hunt-state-store";
import { getDataMode, listHuntViews, type HuntView } from "./hunt-repository";
import { getMockCommitPosition } from "./mock-zk";
import { listMyCommitments } from "./my-commitments";
import type { Hunt } from "./types";
import { getUserHunts } from "./user-hunts";

/** Résultat d'une chasse : réussie, échouée ou encore en cours. */
export function huntResult(hunt: Hunt, now: number = Date.now()): HuntResult {
  const count = getCommitCount(hunt);
  const stored = getStoredHuntState(hunt.id);
  const status = deriveHuntStatus(hunt, count, now, stored);
  if (status === "activated") return "success";
  if (status === "expired") return "failure";
  if (status === "settled") {
    if (stored?.settlementOutcome) return stored.settlementOutcome;
    return count >= hunt.threshold ? "success" : "failure";
  }
  return "pending";
}

export function collectWalletActivity(address: string, now: number = Date.now()): WalletActivity {
  const participations = listHunts().flatMap((hunt) => {
    const pos = getMockCommitPosition(hunt.id, address);
    if (!pos) return [];
    return [
      {
        huntId: hunt.id,
        // Les engagements de démo (hunt.commitCount) précèdent les engagements locaux.
        rank: hunt.commitCount + pos.localRank,
        threshold: hunt.threshold,
        result: huntResult(hunt, now),
        committedAt: pos.createdAt,
      },
    ];
  });

  const creations = getUserHunts(address).flatMap((ref) => {
    const hunt = getHunt(ref.huntId);
    if (!hunt) return [];
    return [
      {
        huntId: hunt.id,
        result: huntResult(hunt, now),
        commitCount: getCommitCount(hunt),
        progressVisibility: hunt.progressVisibility ?? ("visible" as const),
      },
    ];
  });

  const sharedResults = getSharedHuntIds(address).flatMap((id) => {
    const hunt = getHunt(id);
    return hunt ? [huntResult(hunt, now)] : [];
  });

  return { participations, creations, sharedResults };
}

export function getWalletBadges(address: string): EarnedBadge[] {
  return computeBadges(collectWalletActivity(address));
}

/** Résultat d'une chasse à partir de sa vue (mode registre partagé). */
function viewResult(v: HuntView): HuntResult {
  if (v.status === "activated") return "success";
  if (v.status === "expired") return "failure";
  if (v.status === "settled") return v.outcome ?? "failure";
  return "pending";
}

/**
 * Activité du wallet dans le mode courant : locale, ou registre partagé
 * (chasses lues sur le serveur, engagements de ce wallet mémorisés ici).
 */
export async function loadWalletActivity(address: string): Promise<WalletActivity> {
  if (getDataMode() === "local") return collectWalletActivity(address);
  const views = new Map((await listHuntViews()).map((v) => [v.hunt.id, v]));

  const participations = Object.entries(listMyCommitments(address)).flatMap(([huntId, c]) => {
    const v = views.get(huntId);
    // Rang inconnu (engagement fait ailleurs) : pas de badge de rang.
    if (!v || c.rank === undefined) return [];
    return [
      {
        huntId,
        rank: c.rank,
        threshold: v.hunt.threshold,
        result: viewResult(v),
        committedAt: c.committedAt,
      },
    ];
  });

  const creations = getUserHunts(address).flatMap((ref) => {
    const v = views.get(ref.huntId);
    if (!v) return [];
    return [
      {
        huntId: v.hunt.id,
        result: viewResult(v),
        commitCount: v.commitCount ?? 0,
        progressVisibility: v.hunt.progressVisibility ?? ("visible" as const),
      },
    ];
  });

  const sharedResults = getSharedHuntIds(address).flatMap((id) => {
    const v = views.get(id);
    return v ? [viewResult(v)] : [];
  });

  return { participations, creations, sharedResults };
}

export async function loadWalletBadges(address: string): Promise<EarnedBadge[]> {
  return computeBadges(await loadWalletActivity(address));
}

/**
 * Badges affichables publiquement : vide si le wallet a choisi « privé ».
 * À utiliser par toute future vue publique (profil, liste d'engagés…).
 */
export function getPublicBadges(address: string): EarnedBadge[] {
  return getBadgeVisibility(address) === "public" ? getWalletBadges(address) : [];
}
