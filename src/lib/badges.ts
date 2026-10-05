// Badges Huntited — récompenses NON financières.
// Ils ne modifient jamais les montants (hunt-economics.ts n'en dépend pas).
// Ce module est pur : il calcule les badges à partir de l'activité d'un
// wallet, sans lire le stockage (voir badge-activity.ts pour la collecte).
import type { ProgressVisibility } from "./types";

export type BadgeId =
  | "pionnier"
  | "declencheur"
  | "habitue"
  | "serie"
  | "perseverant"
  | "batisseur"
  | "rassembleur"
  | "visionnaire"
  | "messager";

export type BadgeTier = "bronze" | "argent" | "or";
export type BadgeCategory = "participation" | "creation" | "propagation";
export type HuntResult = "success" | "failure" | "pending";

export interface BadgeDefinition {
  id: BadgeId;
  name: string;
  /** Comment l'obtenir, en une phrase. */
  description: string;
  category: BadgeCategory;
}

/** Règles chiffrées (modifiables ici sans toucher au reste). */
export const BADGE_RULES = {
  /** Pionnier·ère : parmi les 10 % premiers engagés (au moins le 1er). */
  pioneerShare: 10,
  /** Habitué·e : nombre de chasses réussies pour bronze / argent / or. */
  regularTiers: { bronze: 1, argent: 5, or: 25 },
  /** Série : mois civils consécutifs avec au moins un engagement. */
  streakMonths: 3,
  /** Persévérant·e : chasses échouées auxquelles on s'est engagé·e. */
  persistentFailures: 3,
  /** Rassembleur·se : engagés minimum d'une chasse réussie créée. */
  gathererCommits: 50,
} as const;

export const BADGES: readonly BadgeDefinition[] = [
  {
    id: "pionnier",
    name: "Pionnier·ère",
    description: "Parmi les 10 % premiers engagés d'une chasse qui a réussi.",
    category: "participation",
  },
  {
    id: "declencheur",
    name: "Déclencheur·se",
    description: "Ton engagement a fait franchir le seuil d'une chasse.",
    category: "participation",
  },
  {
    id: "habitue",
    name: "Habitué·e",
    description: "Engagé·e dans 1, 5 puis 25 chasses réussies (bronze, argent, or).",
    category: "participation",
  },
  {
    id: "serie",
    name: "Série",
    description: "Engagé·e au moins une fois par mois, 3 mois de suite.",
    category: "participation",
  },
  {
    id: "perseverant",
    name: "Persévérant·e",
    description: "Engagé·e dans 3 chasses qui n'ont pas atteint leur seuil.",
    category: "participation",
  },
  {
    id: "batisseur",
    name: "Bâtisseur·se",
    description: "Tu as créé une chasse qui a réussi.",
    category: "creation",
  },
  {
    id: "rassembleur",
    name: "Rassembleur·se",
    description: "Tu as créé une chasse réussie avec au moins 50 engagés.",
    category: "creation",
  },
  {
    id: "visionnaire",
    name: "Visionnaire",
    description: "Tu as créé une chasse réussie à progression masquée.",
    category: "creation",
  },
  {
    id: "messager",
    name: "Messager·ère",
    description: "Tu as partagé une chasse qui a ensuite réussi.",
    category: "propagation",
  },
];

export interface Participation {
  huntId: string;
  /** Position de l'engagement dans la chasse (1 = premier). */
  rank: number;
  threshold: number;
  /**
   * Résultat pour CET engagé·e : « success » seulement s'il ou elle fait
   * partie du groupe retenu d'une chasse réussie.
   */
  result: HuntResult;
  committedAt: number;
  /** Engagement qui a déclenché l'activation (seuils personnels) ; défaut : le seuil. */
  triggerRank?: number;
}

export interface Creation {
  huntId: string;
  result: HuntResult;
  commitCount: number;
  progressVisibility: ProgressVisibility;
}

export interface WalletActivity {
  participations: Participation[];
  creations: Creation[];
  /** Résultat de chaque chasse partagée par ce wallet. */
  sharedResults: HuntResult[];
}

export interface EarnedBadge {
  id: BadgeId;
  /** Nombre de fois où la condition est remplie. */
  count: number;
  tier?: BadgeTier;
}

function isPioneer(p: Participation): boolean {
  const pioneers = Math.max(1, Math.ceil((p.threshold * BADGE_RULES.pioneerShare) / 100));
  return p.rank <= pioneers;
}

/** Plus longue suite de mois civils consécutifs (UTC) contenant un engagement. */
function longestMonthStreak(timestamps: number[]): number {
  const months = [
    ...new Set(
      timestamps.map((t) => {
        const d = new Date(t);
        return d.getUTCFullYear() * 12 + d.getUTCMonth();
      }),
    ),
  ].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  months.forEach((m, i) => {
    run = i > 0 && m === months[i - 1]! + 1 ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}

function regularTier(successes: number): BadgeTier | undefined {
  const t = BADGE_RULES.regularTiers;
  if (successes >= t.or) return "or";
  if (successes >= t.argent) return "argent";
  if (successes >= t.bronze) return "bronze";
  return undefined;
}

/** Badges obtenus, dans l'ordre du catalogue BADGES. */
export function computeBadges(a: WalletActivity): EarnedBadge[] {
  const won = a.participations.filter((p) => p.result === "success");
  const lost = a.participations.filter((p) => p.result === "failure");
  const createdWon = a.creations.filter((c) => c.result === "success");

  const counts: Record<BadgeId, number> = {
    pionnier: won.filter(isPioneer).length,
    declencheur: won.filter((p) => p.rank === (p.triggerRank ?? p.threshold)).length,
    habitue: won.length,
    serie:
      longestMonthStreak(a.participations.map((p) => p.committedAt)) >= BADGE_RULES.streakMonths
        ? 1
        : 0,
    perseverant: lost.length >= BADGE_RULES.persistentFailures ? lost.length : 0,
    batisseur: createdWon.length,
    rassembleur: createdWon.filter((c) => c.commitCount >= BADGE_RULES.gathererCommits).length,
    visionnaire: createdWon.filter((c) => c.progressVisibility === "hidden").length,
    messager: a.sharedResults.filter((r) => r === "success").length,
  };

  return BADGES.flatMap((b): EarnedBadge[] => {
    const count = counts[b.id];
    if (count === 0) return [];
    if (b.id === "habitue") {
      const tier = regularTier(count);
      return tier ? [{ id: b.id, count, tier }] : [];
    }
    return [{ id: b.id, count }];
  });
}
