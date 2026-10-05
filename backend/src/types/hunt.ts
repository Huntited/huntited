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
  /** ISO 8601. */
  deadline: string;
  threshold: number;
  progressVisibility: ProgressVisibility;
  /** Empreinte du wallet créateur (fingerprintWallet). */
  creatorKey: string;
  createdAt: string;
  activatedAt?: string;
  /** Nombre d'engagements au moment où le groupe retenu s'est formé. */
  activationRank?: number;
  settledAt?: string;
  outcome?: HuntOutcome;
}

/** Engagement stocké : empreinte propre à la chasse, jamais l'adresse. */
export interface StoredCommit {
  huntId: string;
  commitKey: string;
  createdAt: string;
  /** Seuil personnel (≥ seuil de la chasse) ; absent = seuil de la chasse. Privé. */
  personalThreshold?: number;
}

export interface NewHuntInput {
  title: string;
  description: string;
  location: string;
  deadline: string;
  threshold: number;
  progressVisibility: ProgressVisibility;
}

/** Vue publique : jamais d'empreinte ; compteur masqué si demandé. */
export interface PublicHunt {
  id: string;
  title: string;
  description: string;
  location: string;
  deadline: string;
  threshold: number;
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
