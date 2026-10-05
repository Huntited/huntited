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
  settledAt?: string;
  outcome?: HuntOutcome;
}

/** Engagement stocké : empreinte propre à la chasse, jamais l'adresse. */
export interface StoredCommit {
  huntId: string;
  commitKey: string;
  createdAt: string;
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
  outcome?: HuntOutcome;
  createdAt: string;
  activatedAt?: string;
  settledAt?: string;
}
