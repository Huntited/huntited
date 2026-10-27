// Formulaire de création : ville vérifiée, pays trouvé tout seul, action en ligne.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigate = vi.hoisted(() => vi.fn());
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));
vi.mock("@/lib/cities", async (orig) => {
  const real = await orig<typeof import("@/lib/cities")>();
  const index = real.indexCities([
    ["Marseille", "FR", 870_000],
    ["London", "GB", 8_900_000, "Londres"],
    ["London", "CA", 400_000],
  ]);
  return { ...real, loadCities: () => Promise.resolve(index) };
});
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

import { CreateHuntForm } from "@/components/hunt/CreateHuntForm";
import { getCreateHuntDraft } from "@/lib/create-hunt-store";
import { ONLINE_LOCATION } from "@/lib/online";

const country = () => screen.getByLabelText("Pays") as HTMLSelectElement;
const city = () => screen.getByLabelText("Ville") as HTMLInputElement;

function fillRest() {
  fireEvent.change(screen.getByLabelText("Titre"), { target: { value: "Action" } });
  fireEvent.change(screen.getByLabelText(/Description/), { target: { value: "Ensemble" } });
  fireEvent.change(screen.getByLabelText(/Date et heure limite/), {
    target: { value: "2030-01-01T20:00" },
  });
  fireEvent.change(screen.getByLabelText(/Seuil/), { target: { value: "10" } });
}

beforeEach(() => {
  localStorage.clear();
  navigate.mockReset();
});

describe("lieu d'une action", () => {
  it("une ville tapée en entier remplit le pays et prend son nom officiel", async () => {
    render(<CreateHuntForm />);
    await waitFor(() => expect(country().options.length).toBeGreaterThan(1));
    fireEvent.change(city(), { target: { value: "marseille" } });
    await waitFor(() => expect(country().value).toBe("FR"));
    fillRest();
    fireEvent.click(screen.getByRole("button", { name: "Vérifier mon action" }));
    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(getCreateHuntDraft()).toMatchObject({ location: "Marseille", country: "FR" });
  });

  it("ville homonyme : la plus peuplée, mais un autre pays reste possible", async () => {
    render(<CreateHuntForm />);
    await waitFor(() => expect(country().options.length).toBeGreaterThan(1));
    fireEvent.change(city(), { target: { value: "london" } });
    await waitFor(() => expect(country().value).toBe("GB"));
    fireEvent.change(country(), { target: { value: "CA" } });
    fillRest();
    fireEvent.click(screen.getByRole("button", { name: "Vérifier mon action" }));
    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(getCreateHuntDraft()).toMatchObject({ location: "London", country: "CA" });
  });

  it("refuse une ville inconnue, ou absente du pays choisi", async () => {
    render(<CreateHuntForm />);
    await waitFor(() => expect(country().options.length).toBeGreaterThan(1));
    fireEvent.change(city(), { target: { value: "Nulleville" } });
    fireEvent.change(country(), { target: { value: "FR" } });
    fillRest();
    fireEvent.click(screen.getByRole("button", { name: "Vérifier mon action" }));
    expect(await screen.findByText(/Ville introuvable/)).toBeInTheDocument();
    fireEvent.change(city(), { target: { value: "Marseille" } });
    fireEvent.change(country(), { target: { value: "BE" } });
    expect(await screen.findByText(/pas dans le pays choisi/)).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("action en ligne : ni ville ni pays", async () => {
    render(<CreateHuntForm />);
    fireEvent.click(screen.getByRole("radio", { name: "En ligne" }));
    expect(screen.queryByLabelText("Ville")).toBeNull();
    expect(screen.queryByLabelText("Pays")).toBeNull();
    fillRest();
    fireEvent.click(screen.getByRole("button", { name: "Vérifier mon action" }));
    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(getCreateHuntDraft()).toMatchObject({ location: ONLINE_LOCATION, country: "" });
  });
});
