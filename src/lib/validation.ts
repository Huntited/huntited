import { MAX_CAUTION_KAS, MIN_CAUTION_KAS, MIN_THRESHOLD } from "@/lib/hunt-economics";
import type { HuntFormData } from "@/lib/types";

/**
 * Seuil minimum d'une chasse : MIN_THRESHOLD (7). En développement seulement,
 * VITE_MIN_THRESHOLD peut l'abaisser pour tester à deux navigateurs (le
 * serveur doit alors avoir le même réglage, MIN_HUNT_THRESHOLD).
 */
export function minHuntThreshold(): number {
  const dev = Number(import.meta.env["VITE_MIN_THRESHOLD"]);
  return import.meta.env.DEV && Number.isInteger(dev) && dev >= 1 && dev < MIN_THRESHOLD
    ? dev
    : MIN_THRESHOLD;
}

export interface FormErrors {
  title?: string;
  description?: string;
  location?: string;
  deadline?: string;
  threshold?: string;
  deposit?: string;
  global?: string;
}

export function validateHuntForm(data: HuntFormData): FormErrors {
  const errors: FormErrors = {};

  if (!data.title || data.title.trim().length === 0) {
    errors.title = "Le titre est requis.";
  } else if (data.title.length > 80) {
    errors.title = "Le titre ne doit pas dépasser 80 caractères.";
  }

  if (!data.description || data.description.trim().length === 0) {
    errors.description = "La description est requise.";
  } else if (data.description.length > 1000) {
    errors.description = "La description ne doit pas dépasser 1000 caractères.";
  }

  if (!data.location || data.location.trim().length === 0) {
    errors.location = "Le lieu est requis.";
  }

  if (!data.deadline) {
    errors.deadline = "La date limite est requise.";
  } else {
    const deadlineDate = new Date(data.deadline);
    const now = new Date();
    if (isNaN(deadlineDate.getTime())) {
      errors.deadline = "La date limite n'est pas valide.";
    } else if (deadlineDate <= now) {
      errors.deadline = "La date limite doit être dans le futur.";
    }
  }

  if (!data.threshold || data.threshold <= 0) {
    errors.threshold = "Le seuil doit être un nombre strictement positif.";
  } else if (!Number.isInteger(data.threshold)) {
    errors.threshold = "Le seuil doit être un nombre entier.";
  } else if (data.threshold < minHuntThreshold()) {
    errors.threshold = `Le seuil doit être d'au moins ${minHuntThreshold()} personnes.`;
  } else if (data.threshold > 100000) {
    errors.threshold = "Le seuil est trop élevé.";
  }

  if (!Number.isInteger(data.deposit) || data.deposit < MIN_CAUTION_KAS) {
    errors.deposit = `La caution doit être un nombre entier d'au moins ${MIN_CAUTION_KAS} KAS.`;
  } else if (data.deposit > MAX_CAUTION_KAS) {
    errors.deposit = "La caution est trop élevée.";
  }

  return errors;
}

export function hasErrors(errors: FormErrors): boolean {
  return Object.values(errors).some((e) => !!e);
}
