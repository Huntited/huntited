import type { HuntFormData } from "./types";

/**
 * Brouillon du formulaire de création, conservé uniquement sur cet appareil
 * (localStorage) le temps de passer par la page de récapitulatif.
 * Il est effacé dès que la chasse est créée. Aucun envoi, aucun log.
 */
const STORAGE_KEY = "huntited:create-hunt-draft";

/** Vérifie qu'une valeur lue ressemble bien à un brouillon valide. */
function isDraft(value: unknown): value is HuntFormData {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v["title"] === "string" &&
    typeof v["description"] === "string" &&
    typeof v["location"] === "string" &&
    typeof v["deadline"] === "string" &&
    typeof v["threshold"] === "number" &&
    typeof v["deposit"] === "number" &&
    typeof v["commitDeposit"] === "number"
  );
}

/** Lit le brouillon (null si absent, invalide, ou côté serveur). */
export function getCreateHuntDraft(): HuntFormData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isDraft(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Enregistre le brouillon. */
export function setCreateHuntDraft(data: HuntFormData): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

const BACK_KEY = "huntited:create-back";

/** Récapitulatif → « Retour » : le formulaire reprendra le brouillon (une fois). */
export function markBackToForm(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(BACK_KEY, "1");
  } catch {
    /* sans stockage : le formulaire repartira vide */
  }
}

/** true (une seule fois) si l'on revient du récapitulatif. */
export function takeBackToForm(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const back = window.sessionStorage.getItem(BACK_KEY) === "1";
    window.sessionStorage.removeItem(BACK_KEY);
    return back;
  } catch {
    return false;
  }
}

/** Efface le brouillon (après création ou abandon). */
export function clearCreateHuntDraft(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
