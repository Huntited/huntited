// Bouton « Me prévenir » : masqué si indisponible, bascule suivi / non suivi.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.hoisted(() => ({
  getPushKey: vi.fn<() => Promise<string | null>>(),
  followHunt: vi.fn<() => Promise<"ok" | "denied" | "unavailable">>(),
  unfollowHunt: vi.fn<() => Promise<void>>(),
  isFollowing: vi.fn<() => boolean>(),
}));
vi.mock("@/lib/push", () => push);

import { NotifyButton } from "@/components/hunt/NotifyButton";

beforeEach(() => {
  vi.clearAllMocks();
  push.isFollowing.mockReturnValue(false);
  push.unfollowHunt.mockResolvedValue();
});

describe("NotifyButton", () => {
  it("n'apparaît pas si les notifications sont indisponibles", async () => {
    push.getPushKey.mockResolvedValue(null);
    const { container } = render(<NotifyButton huntId="h1" />);
    await waitFor(() => expect(push.getPushKey).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("s'abonne puis se désabonne", async () => {
    push.getPushKey.mockResolvedValue("key");
    push.followHunt.mockResolvedValue("ok");
    render(<NotifyButton huntId="h1" />);
    fireEvent.click(await screen.findByRole("button", { name: /Me prévenir du résultat/ }));
    const on = await screen.findByRole("button", { name: /Tu seras prévenu·e/ });
    expect(on).toHaveAttribute("aria-pressed", "true");
    expect(push.followHunt).toHaveBeenCalledWith("h1", "fr");
    fireEvent.click(on);
    await screen.findByRole("button", { name: /Me prévenir du résultat/ });
    expect(push.unfollowHunt).toHaveBeenCalledWith("h1");
  });

  it("explique quoi faire si les notifications sont bloquées", async () => {
    push.getPushKey.mockResolvedValue("key");
    push.followHunt.mockResolvedValue("denied");
    render(<NotifyButton huntId="h1" />);
    fireEvent.click(await screen.findByRole("button", { name: /Me prévenir/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("bloquées");
  });
});
