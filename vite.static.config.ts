// Construction de la version statique (IPFS) : `npm run build:static`.
// Indépendante de la version serveur (vite.config.ts) : pas de rendu serveur,
// chemins relatifs (fonctionne sous /ipfs/<identifiant>/ comme sur un domaine).
import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: path.resolve(__dirname, "static"),
  base: "./",
  publicDir: path.resolve(__dirname, "public"),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@tanstack/react-start": path.resolve(__dirname, "static/start-shim.ts"),
    },
  },
  build: {
    outDir: path.resolve(__dirname, "dist-static"),
    emptyOutDir: true,
  },
});
