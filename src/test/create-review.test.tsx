import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { setCreateHuntDraft } from "@/lib/create-hunt-store";
import { getUserHunts } from "@/lib/user-hunts";
import { connectWallet, disconnectWallet, getWalletState } from "@/lib/wallet";
import { routeTree } from "@/routeTree.gen";

function renderReview() {
  const router = createRouter({
    routeTree,
    context: { queryClient: new QueryClient() },
    history: createMemoryHistory({ initialEntries: ["/create-review"] }),
  });
  render(<RouterProvider router={router} />);
  return router;
}

beforeEach(() => {
  window.localStorage.clear();
  disconnectWallet();
  setCreateHuntDraft({
    title: "Chasse de test",
    description: "Description de test.",
    location: "Lieu de test",
    deadline: new Date(Date.now() + 86_400_000).toISOString().slice(0, 16),
    threshold: 2,
    deposit: 30,
    commitDeposit: 5,
  });
});

afterEach(() => cleanup());

describe("Création d'une chasse : wallet obligatoire", () => {
  it("sans wallet, la création n'est pas proposée", async () => {
    renderReview();

    expect(await screen.findByRole("button", { name: "Connecter le wallet" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Confirmer et créer la chasse" })).toBeNull();
  });

  it("avec un wallet, la chasse est rattachée à son créateur", async () => {
    await connectWallet();
    const address = getWalletState().address!;
    const router = renderReview();

    fireEvent.click(await screen.findByRole("button", { name: "Confirmer et créer la chasse" }));

    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/hunt\//));
    const huntId = router.state.location.pathname.split("/").pop();
    expect(getUserHunts(address).map((h) => h.huntId)).toContain(huntId);
  });
});
