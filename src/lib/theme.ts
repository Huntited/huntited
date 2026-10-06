// Thème clair / sombre : choix de la personne (mémorisé sur cet appareil) ou,
// par défaut, celui du système. La classe `dark` sur <html> active les
// couleurs sombres définies dans styles.css.
import { useEffect, useState } from "react";

export type ThemeChoice = "light" | "dark";
const STORAGE_KEY = "huntited:theme";

/**
 * Script exécuté dans <head> avant l'affichage : applique le thème tout de
 * suite, sans flash de la mauvaise couleur au chargement.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${STORAGE_KEY}");var d=t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;

function current(): ThemeChoice {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function setTheme(theme: ThemeChoice): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* choix non mémorisé : valable pour cette visite */
  }
  listeners.forEach((fn) => fn(theme));
}

const listeners = new Set<(t: ThemeChoice) => void>();

export function useTheme(): { theme: ThemeChoice; toggle: () => void } {
  // « light » au premier rendu (identique au rendu serveur), puis le vrai thème.
  const [theme, setState] = useState<ThemeChoice>("light");
  useEffect(() => {
    setState(current());
    listeners.add(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);
  return { theme, toggle: () => setTheme(theme === "dark" ? "light" : "dark") };
}
