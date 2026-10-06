// Config propre au backend : sans elle, Vitest remonte jusqu'à celle du front
// (jsdom, plugins Vite), absente quand seul le backend est installé (CI).
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
});
