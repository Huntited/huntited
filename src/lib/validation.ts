import { MAX_CAUTION_KAS, MIN_CAUTION_KAS, MIN_THRESHOLD } from "@/lib/hunt-economics";
import { isCountryCode } from "@/lib/countries";
import { hasPlaceholder } from "@/lib/hunt-templates";
import { translate, type Locale } from "@/lib/i18n";
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
  country?: string;
  deadline?: string;
  threshold?: string;
  deposit?: string;
  global?: string;
}

/** Messages dans la langue demandée (français par défaut). */
export function validateHuntForm(data: HuntFormData, locale: Locale = "fr"): FormErrors {
  const errors: FormErrors = {};
  const m = (key: Parameters<typeof translate>[1], vars?: Record<string, number>) =>
    translate(locale, key, vars);

  if (!data.title || data.title.trim().length === 0) {
    errors.title = m("val.title.required");
  } else if (data.title.length > 80) {
    errors.title = m("val.title.long");
  } else if (hasPlaceholder(data.title)) {
    errors.title = m("val.placeholder");
  }

  if (!data.description || data.description.trim().length === 0) {
    errors.description = m("val.description.required");
  } else if (data.description.length > 1000) {
    errors.description = m("val.description.long");
  } else if (hasPlaceholder(data.description)) {
    errors.description = m("val.placeholder");
  }

  if (!data.location || data.location.trim().length === 0) {
    errors.location = m("val.location.required");
  }

  if (!isCountryCode(data.country)) {
    errors.country = m("val.country.required");
  }

  if (!data.deadline) {
    errors.deadline = m("val.deadline.required");
  } else {
    const deadlineDate = new Date(data.deadline);
    const now = new Date();
    if (isNaN(deadlineDate.getTime())) {
      errors.deadline = m("val.deadline.invalid");
    } else if (deadlineDate <= now) {
      errors.deadline = m("val.deadline.past");
    }
  }

  if (!data.threshold || data.threshold <= 0) {
    errors.threshold = m("val.threshold.positive");
  } else if (!Number.isInteger(data.threshold)) {
    errors.threshold = m("val.threshold.integer");
  } else if (data.threshold < minHuntThreshold()) {
    errors.threshold = m("val.threshold.min", { min: minHuntThreshold() });
  } else if (data.threshold > 100000) {
    errors.threshold = m("val.threshold.max");
  }

  if (!Number.isInteger(data.deposit) || data.deposit < MIN_CAUTION_KAS) {
    errors.deposit = m("val.caution.min", { min: MIN_CAUTION_KAS });
  } else if (data.deposit > MAX_CAUTION_KAS) {
    errors.deposit = m("val.caution.max");
  }

  return errors;
}

export function hasErrors(errors: FormErrors): boolean {
  return Object.values(errors).some((e) => !!e);
}
