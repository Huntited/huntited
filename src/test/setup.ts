import "@testing-library/jest-dom/vitest";

// Langue du navigateur simulé : français (les tests vérifient les textes
// français ; i18n.test.ts change cette valeur au besoin).
Object.defineProperty(window.navigator, "language", {
  configurable: true,
  get: () => "fr-FR",
});

Object.defineProperty(window, "scrollTo", {
  writable: true,
  value: () => {},
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
