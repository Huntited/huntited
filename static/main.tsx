// Point d'entrée de la version statique : même application, mêmes pages,
// mais rendue entièrement dans le navigateur (aucun serveur), avec une
// navigation par « # » (/#/hunt/…) qui fonctionne sur n'importe quelle
// passerelle IPFS, sans règle de réécriture.
import { applyInitialTheme } from "./theme";
import { QueryClient } from "@tanstack/react-query";
import { createHashHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { routeTree } from "@/routeTree.gen";

applyInitialTheme();

const router = createRouter({
  routeTree,
  history: createHashHistory(),
  context: { queryClient: new QueryClient() },
  scrollRestoration: true,
  defaultPreloadStaleTime: 0,
});

// Accueil : adresse propre (huntited.com/ plutôt que huntited.com/#/). Les
// autres pages gardent le # : sans serveur (Codeberg, IPFS), c'est lui qui
// permet d'ouvrir directement n'importe quelle page.
router.subscribe("onResolved", () => {
  const { hash, pathname, search } = window.location;
  if (hash === "#/" || hash === "#") {
    window.history.replaceState(window.history.state, "", pathname + search);
  }
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
