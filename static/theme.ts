// Thème appliqué avant le premier affichage (même règle que la version
// serveur). Fichier séparé plutôt que script dans index.html : certaines
// passerelles IPFS interdisent les scripts écrits dans la page (CSP).
try {
  const t = localStorage.getItem("huntited:theme");
  const dark = t ? t === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  if (dark) document.documentElement.classList.add("dark");
} catch {
  /* stockage indisponible : thème clair */
}
