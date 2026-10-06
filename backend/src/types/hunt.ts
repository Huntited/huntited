// Types du registre partagé des chasses.
import type { HuntOutcome } from "./auth.js";

export type ProgressVisibility = "visible" | "hidden";
export type RegistryHuntStatus = "active" | "activated" | "expired" | "settled";

/** Chasse telle que stockée. Aucune adresse : le créateur est une empreinte. */
export interface StoredHunt {
  id: string;
  title: string;
  description: string;
  location: string;
  /** Pays (code ISO 3166-1 alpha-2) ; absent pour les anciennes chasses. */
  country?: string;
  /** ISO 8601. */
  deadline: string;
  threshold: number;
  /** Caution du créateur en KAS (absente des anciennes chasses : 30). */
  deposit?: number;
  progressVisibility: ProgressVisibility;
  /** Empreinte du wallet créateur (fingerprintWallet). */
  creatorKey: string;
  createdAt: string;
  activatedAt?: string;
  /** Nombre d'engagements au moment où le groupe retenu s'est formé. */
  activationRank?: number;
  settledAt?: string;
  outcome?: HuntOutcome;
  /**
   * Chasse ratée : nombre d'engagements au moment de leur effacement (24 h
   * après la date limite). Seul ce nombre reste, pour l'affichage.
   */
  purgedCommitCount?: number;
}

/** Engagement stocké : empreinte propre à la chasse, jamais l'adresse. */
export interface StoredCommit {
  huntId: string;
  commitKey: string;
  createdAt: string;
  /** Seuil personnel (≥ seuil de la chasse) ; absent = seuil de la chasse. Privé. */
  personalThreshold?: number;
  /**
   * Code de pass pour cette chasse (nullifier Semaphore) : une personne = un
   * engagement. Ne permet ni de retrouver le pass, ni de relier deux chasses.
   */
  personKey?: string;
}

export interface NewHuntInput {
  title: string;
  description: string;
  location: string;
  country?: string;
  deadline: string;
  threshold: number;
  deposit: number;
  progressVisibility: ProgressVisibility;
}

/** Vue publique : jamais d'empreinte ; compteur masqué si demandé. */
export interface PublicHunt {
  id: string;
  title: string;
  description: string;
  location: string;
  country?: string;
  deadline: string;
  threshold: number;
  /** Caution du créateur, en KAS. */
  deposit: number;
  progressVisibility: ProgressVisibility;
  status: RegistryHuntStatus;
  /** null tant qu'une chasse à progression masquée est en phase d'engagement. */
  commitCount: number | null;
  /** Taille du groupe retenu (masquée comme commitCount). */
  retainedCount: number | null;
  /** Seuil personnel maximal satisfait (k*) ; null sans groupe ou si masqué. */
  retainedThreshold: number | null;
  /** Engagement qui a déclenché l'activation (si non masqué). */
  activationRank?: number;
  /** Engagements encore acceptés (active, ou activée avant la date limite). */
  commitsOpen: boolean;
  outcome?: HuntOutcome;
  createdAt: string;
  activatedAt?: string;
  settledAt?: string;
}
