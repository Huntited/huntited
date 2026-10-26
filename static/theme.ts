// Thème appliqué avant le premier affichage (même règle que la version
// serveur). Fichier séparé plutôt que script dans index.html : certaines
// passerelles IPFS interdisent les scripts écrits dans la page (CSP).
// Une fonction appelée par main.tsx, pas un simple import : le projet se
// déclare sans effets de bord (package.json), un import seul serait retiré.
export function applyInitialTheme(): void {
  try {
    // Dans l'app Huntited Chat : le thème de l'app (clair, sombre, ou celui du téléphone).
    const app = (window as unknown as { HuntitedApp?: { theme?: () => string } }).HuntitedApp;
    const inApp = app?.theme?.();
    const t =
      inApp === "dark" || inApp === "light" ? inApp : localStorage.getItem("huntited:theme");
    const dark = t ? t === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", dark);
  } catch {
    /* stockage indisponible : thème clair */
  }
}
