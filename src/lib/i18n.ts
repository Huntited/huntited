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
  // Dans l'app Huntited Chat : la langue choisie dans l'app, pour tout afficher pareil.
  try {
    const app = (window as unknown as { HuntitedApp?: { language?: () => string } }).HuntitedApp;
    const inApp = app?.language?.();
    if (inApp === "fr" || inApp === "en") return inApp;
  } catch {
    /* app plus ancienne */
  }
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "fr" || saved === "en") return saved;
  } catch {
    /* stockage indisponible : langue du navigateur */
  }
  // Langue inconnue : français, la langue par défaut du site.
  const language = (navigator.language as string | undefined)?.toLowerCase();
  return !language || language.startsWith("fr") ? "fr" : "en";
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

/** Durée relative courte (« dans 2 jours », « il y a 3 heures »). */
export function formatRelative(locale: Locale, date: string | number | Date, now = Date.now()) {
  const diff = new Date(date).getTime() - now;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
    numeric: "auto",
  });
  if (abs >= 86_400_000) return rtf.format(Math.round(diff / 86_400_000), "day");
  if (abs >= 3_600_000) return rtf.format(Math.round(diff / 3_600_000), "hour");
  return rtf.format(Math.round(diff / 60_000), "minute");
}

export interface UseI18n {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
  date: (d: string | number | Date, options?: Intl.DateTimeFormatOptions) => string;
  relative: (d: string | number | Date) => string;
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
  const relative = useCallback((d: string | number | Date) => formatRelative(locale, d), [locale]);
  return { locale, setLocale, t, date, relative };
}
