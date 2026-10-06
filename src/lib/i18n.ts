// Traductions français / anglais, sans bibliothèque.
//
// La langue est choisie par la personne (bouton FR | EN, mémorisé sur cet
// appareil) ou, à défaut, déduite de la langue du navigateur. Le rendu serveur
// et le premier rendu client sont toujours en français (même HTML des deux
// côtés) ; la langue réelle est appliquée juste après l'hydratation.
import { useCallback, useEffect, useState } from "react";

import { en } from "./messages/en";
import { fr, type Messages } from "./messages/fr";

export type Locale = "fr" | "en";
export type MessageKey = keyof Messages;

const STORAGE_KEY = "huntited:locale";
const DICTIONARIES: Record<Locale, Messages> = { fr, en };

let current: Locale | null = null;
const listeners = new Set<(l: Locale) => void>();

function detect(): Locale {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "fr" || saved === "en") return saved;
  } catch {
    /* stockage indisponible : langue du navigateur */
  }
  return navigator.language.toLowerCase().startsWith("fr") ? "fr" : "en";
}

/** Langue active côté navigateur (« fr » côté serveur). */
export function getLocale(): Locale {
  if (typeof window === "undefined") return "fr";
  current ??= detect();
  return current;
}

export function setLocale(locale: Locale): void {
  current = locale;
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    /* choix non mémorisé : valable pour cette visite */
  }
  document.documentElement.lang = locale;
  listeners.forEach((fn) => fn(locale));
}

/** Texte traduit ; `{nom}` est remplacé par `vars.nom`. */
export function translate(
  locale: Locale,
  key: MessageKey,
  vars: Record<string, string | number> = {},
): string {
  const text = DICTIONARIES[locale][key] ?? fr[key];
  return text.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
}

/** Format de date selon la langue. */
export function formatDate(
  locale: Locale,
  date: string | number | Date,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" },
): string {
  return new Date(date).toLocaleString(locale === "fr" ? "fr-FR" : "en-GB", options);
}

export interface UseI18n {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
  date: (d: string | number | Date, options?: Intl.DateTimeFormatOptions) => string;
}

export function useI18n(): UseI18n {
  // « fr » au premier rendu (identique au rendu serveur), puis la vraie langue.
  const [locale, setState] = useState<Locale>("fr");
  useEffect(() => {
    setState(getLocale());
    document.documentElement.lang = getLocale();
    listeners.add(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);
  const t = useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) => translate(locale, key, vars),
    [locale],
  );
  const date = useCallback(
    (d: string | number | Date, options?: Intl.DateTimeFormatOptions) =>
      formatDate(locale, d, options),
    [locale],
  );
  return { locale, setLocale, t, date };
}
