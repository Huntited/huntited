// Construit la version statique de Huntited (dossier dist-static/), à publier
// sur IPFS ou chez n'importe quel hébergeur de fichiers (voir docs/ipfs.md).
//
// Réglages : registre sur la blockchain (réseau de test), wallet Kastle, aucun
// serveur Huntited, navigation par « # ».
import { rmSync } from "node:fs";
import { build } from "vite";

Object.assign(process.env, {
  VITE_DATA_MODE: "chain",
  VITE_WALLET_MODE: "kastle",
  VITE_MATRIX_MODE: "mock",
  // Vide : aucun serveur Huntited (chat, notifications : bientôt).
  VITE_API_BASE_URL: "",
  VITE_HASH_ROUTING: "true",
});

await build({ configFile: "vite.static.config.ts", mode: "production" });

// Fichiers du pass (en réserve, inutilisé ici) : 5,5 Mo de moins à publier.
rmSync("dist-static/zk", { recursive: true, force: true });
console.log("Version statique prête : dist-static/");
