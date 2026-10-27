// Côté RP de Huntited (docs/rpg.md) : expérience, niveaux, titres, classes et
// quêtes de la semaine. NON financier : rien ne change les montants.
//
// L'XP vient seulement d'actions réelles inscrites sur la blockchain
// (engagements, créations, chasses déclenchées puis réussies) : chaque membre
// d'un salon peut recalculer le niveau d'un autre à partir des données
// publiques, sans pouvoir tricher. Ce module est pur (pas de stockage).
import type { LedgerHunt } from "./onchain/ledger";

export type ClassId = "eclaireur" | "stratege" | "gardien" | "rallieur";

export interface RpgClass {
  id: ClassId;
  /** Catégorie d'XP augmentée de 25 %. */
  boost: XpCategory;
}

export type XpCategory = "engage" | "create" | "success" | "quests";

export const CLASSES: readonly RpgClass[] = [
  { id: "eclaireur", boost: "engage" },
  { id: "stratege", boost: "create" },
  { id: "gardien", boost: "success" },
  { id: "rallieur", boost: "quests" },
];

export const isClassId = (v: unknown): v is ClassId =>
  typeof v === "string" && CLASSES.some((c) => c.id === v);

/** Règles chiffrées (modifiables ici sans toucher au reste). */
export const XP_RULES = {
  /** Engagement dans une chasse qui s'est déclenchée. */
  engage: 20,
  /** En plus, si l'engagement a compté pour le déclenchement. */
  trigger: 10,
  /** Création d'une chasse qui s'est déclenchée. */
  create: 80,
  /** Chasse déclenchée arrivée à sa date (l'action a eu lieu) : engagé·e / créateur. */
  successMember: 30,
  successCreator: 50,
  /** Bonus de classe sur sa catégorie. */
  classBoost: 0.25,
} as const;

export interface Quest {
  id: "twoCommits" | "createTriggered" | "triggered";
  xp: number;
  /** Objectif (nombre). */
  goal: number;
}

/** Quêtes de la semaine (semaine du lundi au dimanche, UTC). */
export const QUESTS: readonly Quest[] = [
  { id: "twoCommits", xp: 30, goal: 2 },
  { id: "createTriggered", xp: 40, goal: 1 },
  { id: "triggered", xp: 50, goal: 1 },
];

/** Ce qu'un wallet a fait sur la chaîne, réduit à ce qui compte pour l'XP. */
export interface ChainDeed {
  huntId: string;
  role: "member" | "creator";
  /** Date de l'engagement ou de la création. */
  at: number;
  /** Date de déclenchement, si la chasse s'est déclenchée. */
  triggeredAt?: number;
  /** L'engagement a compté pour le déclenchement (avant lui). */
  counted: boolean;
  /** Déclenchée et arrivée à sa date limite : l'action a eu lieu. */
  success: boolean;
}

/** Actes d'un wallet (`who` : adresse) dans les chasses de la chaîne. */
export function chainDeeds(hunts: LedgerHunt[], who: string, now = Date.now()): ChainDeed[] {
  const deeds: ChainDeed[] = [];
  for (const h of hunts) {
    const triggeredAt = h.activatedAt;
    const success = triggeredAt !== undefined && now > h.deadline;
    const base = { huntId: h.id, ...(triggeredAt !== undefined ? { triggeredAt } : {}), success };
    if (h.creator === who) deeds.push({ ...base, role: "creator", at: h.createdAt, counted: true });
    const commit = h.commits.find((c) => c.who === who);
    if (commit) {
      deeds.push({
        ...base,
        role: "member",
        at: commit.at,
        counted: triggeredAt !== undefined && commit.at <= triggeredAt,
      });
    }
  }
  return deeds;
}

const WEEK = 7 * 24 * 3600 * 1000;
/** Début (lundi 0 h UTC) de la semaine d'un instant. */
export function weekStart(t: number): number {
  const d = new Date(t);
  const day = (d.getUTCDay() + 6) % 7; // lundi = 0
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - day * 24 * 3600 * 1000;
}

/** Avancement des quêtes pour une semaine donnée. */
export function questProgress(deeds: ChainDeed[], week: number): Record<Quest["id"], number> {
  const inWeek = (t: number | undefined) => t !== undefined && t >= week && t < week + WEEK;
  return {
    twoCommits: deeds.filter((d) => d.role === "member" && d.triggeredAt && inWeek(d.at)).length,
    createTriggered: deeds.filter((d) => d.role === "creator" && d.triggeredAt && inWeek(d.at))
      .length,
    triggered: new Set(deeds.filter((d) => inWeek(d.triggeredAt)).map((d) => d.huntId)).size,
  };
}

export interface XpBreakdown {
  engage: number;
  create: number;
  success: number;
  quests: number;
  total: number;
}

/** XP d'un wallet, avec le bonus de sa classe. */
export function computeXp(deeds: ChainDeed[], cls?: ClassId): XpBreakdown {
  const xp = { engage: 0, create: 0, success: 0, quests: 0 };
  for (const d of deeds) {
    if (d.triggeredAt === undefined) continue; // rien tant que la chasse ne s'est pas déclenchée
    if (d.role === "member") {
      xp.engage += XP_RULES.engage + (d.counted ? XP_RULES.trigger : 0);
      if (d.success) xp.success += XP_RULES.successMember;
    } else {
      xp.create += XP_RULES.create;
      if (d.success) xp.success += XP_RULES.successCreator;
    }
  }
  const weeks = new Set(deeds.flatMap((d) => [d.at, d.triggeredAt ?? d.at]).map(weekStart));
  for (const w of weeks) {
    const p = questProgress(deeds, w);
    for (const q of QUESTS) if (p[q.id] >= q.goal) xp.quests += q.xp;
  }
  const boost = CLASSES.find((c) => c.id === cls)?.boost;
  if (boost) xp[boost] = Math.round(xp[boost] * (1 + XP_RULES.classBoost));
  return { ...xp, total: xp.engage + xp.create + xp.success + xp.quests };
}

/** XP qu'il faut pour atteindre un niveau (niveau 1 : 0 ; 2 : 100 ; 3 : 300 ; 4 : 600…). */
export const xpForLevel = (level: number) => 50 * level * (level - 1);

export function levelOf(xp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  return level;
}

export type TitleId =
  "recrue" | "apprenti" | "pisteur" | "traqueur" | "meneur" | "veteran" | "legende";

/** Titre selon le niveau. */
export function titleOf(level: number): TitleId {
  if (level >= 15) return "legende";
  if (level >= 10) return "veteran";
  if (level >= 7) return "meneur";
  if (level >= 5) return "traqueur";
  if (level >= 3) return "pisteur";
  if (level >= 2) return "apprenti";
  return "recrue";
}

export interface Rank {
  xp: number;
  level: number;
  title: TitleId;
  /** XP du niveau en cours et du suivant (barre de progression). */
  from: number;
  to: number;
}

export function rankOf(xp: number): Rank {
  const level = levelOf(xp);
  return { xp, level, title: titleOf(level), from: xpForLevel(level), to: xpForLevel(level + 1) };
}
