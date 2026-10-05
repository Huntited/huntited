import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { BadgesPanel } from "@/components/hunt/BadgesPanel";
import { getBadgeVisibility } from "@/lib/badge-store";

const ADDRESS = "kaspatest:qq_panel_wallet_aaaa";

beforeEach(() => window.localStorage.clear());
afterEach(() => cleanup());

describe("BadgesPanel", () => {
  it("liste les badges à débloquer et enregistre la visibilité pour ce wallet", async () => {
    render(<BadgesPanel address={ADDRESS} />);

    expect(screen.getByText("Pas encore de badge.")).toBeTruthy();
    expect(screen.getByText(/À débloquer \(9\)/)).toBeTruthy();

    const toggle = screen.getByRole("switch", { name: "Badges visibles publiquement" });
    expect(toggle.getAttribute("aria-checked")).toBe("false");

    fireEvent.click(toggle);
    await waitFor(() => expect(toggle.getAttribute("aria-checked")).toBe("true"));
    expect(getBadgeVisibility(ADDRESS)).toBe("public");
    expect(getBadgeVisibility("kaspatest:qq_autre_wallet_bbbb")).toBe("private");
  });
});
