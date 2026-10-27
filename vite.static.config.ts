// Construction de la version statique (IPFS) : `npm run build:static`.
// Aussi utilisée par npm run dev. Pas de rendu serveur, chemins relatifs (fonctionne sous /ipfs/<identifiant>/ comme sur un domaine).
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
    },
  },
  build: {
    outDir: path.resolve(__dirname, "dist-static"),
    emptyOutDir: true,
  },
});
