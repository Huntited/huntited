// Collecte de l'activité d'un wallet pour le calcul des badges (mock local).
// Plus tard : lecture de l'état on-chain / indexeur, seule cette couche changera.
import { getBadgeVisibility, getSharedHuntIds } from "./badge-store";
import { computeBadges, type EarnedBadge, type HuntResult, type WalletActivity } from "./badges";
import { getCommitCount, getHunt, listHunts } from "./covenants";
import { deriveHuntStatus } from "./hunt-lifecycle";
import { getStoredHuntState } from "./hunt-state-store";
import { getMockCommitPosition } from "./mock-zk";
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

/**
 * Badges affichables publiquement : vide si le wallet a choisi « privé ».
 * À utiliser par toute future vue publique (profil, liste d'engagés…).
 */
export function getPublicBadges(address: string): EarnedBadge[] {
  return getBadgeVisibility(address) === "public" ? getWalletBadges(address) : [];
}
