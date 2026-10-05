import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ShareHuntButton } from "@/components/hunt/ShareHuntButton";
import { huntShareUrl } from "@/lib/share";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("partage d'une chasse", () => {
  it("le lien ne contient que l'identifiant de la chasse", () => {
    expect(huntShareUrl("abc123", "https://huntited.example")).toBe(
      "https://huntited.example/hunt/abc123",
    );
    expect(huntShareUrl("a/b?c", "https://x.example")).toBe("https://x.example/hunt/a%2Fb%3Fc");
  });

  it("copie le lien quand le partage natif n'existe pas", async () => {
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal("navigator", { ...navigator, share: undefined, clipboard: { writeText } });

    render(<ShareHuntButton hunt={{ id: "abc123", title: "Test" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Partager" }));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/hunt/abc123`),
    );
    expect(await screen.findByRole("button", { name: "Lien copié" })).toBeTruthy();
  });

  it("utilise le partage natif quand il existe", async () => {
    const share = vi.fn(async () => undefined);
    const writeText = vi.fn();
    vi.stubGlobal("navigator", { ...navigator, share, clipboard: { writeText } });

    render(<ShareHuntButton hunt={{ id: "abc123", title: "Test" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Partager" }));

    await waitFor(() =>
      expect(share).toHaveBeenCalledWith({
        title: "Test",
        url: `${window.location.origin}/hunt/abc123`,
      }),
    );
    expect(writeText).not.toHaveBeenCalled();
  });
});
