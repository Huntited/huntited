// Thème : une palette (vert, océan, corail, papier, violet) en clair ou en
// sombre. Choix de la personne, mémorisé sur cet appareil ; sinon vert, et le
// clair ou le sombre du système. La classe `dark` et l'attribut
// `data-palette` sur <html> activent les couleurs définies dans styles.css.
import { useEffect, useState } from "react";

export type ThemeChoice = "light" | "dark";
export type Palette = "green" | "ocean" | "coral" | "paper" | "violet";
export const PALETTES: Palette[] = ["green", "ocean", "coral", "paper", "violet"];

const STORAGE_KEY = "huntited:theme";
const PALETTE_KEY = "huntited:palette";

/**
 * Script exécuté dans <head> avant l'affichage : applique le thème tout de
 * suite, sans flash de la mauvaise couleur au chargement.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${STORAGE_KEY}");var d=t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d);var p=localStorage.getItem("${PALETTE_KEY}");if(p&&p!=="green")document.documentElement.setAttribute("data-palette",p);}catch(e){}})();`;

function current(): ThemeChoice {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function currentPalette(): Palette {
  const p = document.documentElement.getAttribute("data-palette");
  return PALETTES.includes(p as Palette) ? (p as Palette) : "green";
}

export function setTheme(theme: ThemeChoice): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
  // Dans l'app Huntited Chat : le choix vaut aussi pour l'app.
  try {
    const app = (window as unknown as { HuntitedApp?: { setTheme?: (t: string) => void } })
      .HuntitedApp;
    app?.setTheme?.(theme);
  } catch {
    /* app plus ancienne */
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* choix non mémorisé : valable pour cette visite */
  }
  notify();
}

export function setPalette(palette: Palette): void {
  if (palette === "green") document.documentElement.removeAttribute("data-palette");
  else document.documentElement.setAttribute("data-palette", palette);
  try {
    window.localStorage.setItem(PALETTE_KEY, palette);
  } catch {
    /* choix non mémorisé : valable pour cette visite */
  }
  notify();
}

interface ThemeState {
  theme: ThemeChoice;
  palette: Palette;
}

const listeners = new Set<(s: ThemeState) => void>();
const notify = () => {
  const s = { theme: current(), palette: currentPalette() };
  listeners.forEach((fn) => fn(s));
};

export function useTheme(): ThemeState & {
  toggle: () => void;
  setTheme: typeof setTheme;
  setPalette: typeof setPalette;
} {
  // Vert clair au premier rendu (identique au rendu serveur), puis le vrai thème.
  const [state, setState] = useState<ThemeState>({ theme: "light", palette: "green" });
  useEffect(() => {
    setState({ theme: current(), palette: currentPalette() });
    listeners.add(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);
  return {
    ...state,
    toggle: () => setTheme(state.theme === "dark" ? "light" : "dark"),
    setTheme,
    setPalette,
  };
}
