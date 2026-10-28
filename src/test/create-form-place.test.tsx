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

/** Étape 1 (titre, description), puis « Suivant ». */
function fillStep1AndNext() {
  fireEvent.change(screen.getByLabelText("Titre"), { target: { value: "Action" } });
  fireEvent.change(screen.getByLabelText(/Description/), { target: { value: "Ensemble" } });
  fireEvent.click(screen.getByRole("button", { name: "Suivant" }));
}

/** Étape 2 (date, seuil), puis « Vérifier ». */
async function fillStep2AndSubmit() {
  fireEvent.change(await screen.findByLabelText(/Date et heure limite/), {
    target: { value: "2030-01-01T20:00" },
  });
  fireEvent.change(screen.getByLabelText("Personnes nécessaires", { selector: "#threshold" }), {
    target: { value: "10" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Vérifier" }));
}

beforeEach(() => {
  localStorage.clear();
  navigate.mockReset();
});

describe("lieu d'une action", () => {
  it("une ville tapée en entier remplit le pays (affiché en texte) et prend son nom officiel", async () => {
    render(<CreateHuntForm />);
    fireEvent.change(city(), { target: { value: "marseille" } });
    expect(await screen.findByText("Pays : France.")).toBeInTheDocument();
    // Le pays est connu : pas de longue liste.
    expect(screen.queryByLabelText("Pays")).toBeNull();
    fillStep1AndNext();
    await fillStep2AndSubmit();
    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(getCreateHuntDraft()).toMatchObject({ location: "Marseille", country: "FR" });
  });

  it("ville homonyme : la plus peuplée, mais un autre pays reste possible", async () => {
    render(<CreateHuntForm />);
    fireEvent.change(city(), { target: { value: "london" } });
    expect(await screen.findByText("Pays : Royaume-Uni.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Modifier" }));
    await waitFor(() => expect(country().options.length).toBeGreaterThan(1));
    fireEvent.change(country(), { target: { value: "CA" } });
    fillStep1AndNext();
    await fillStep2AndSubmit();
    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(getCreateHuntDraft()).toMatchObject({ location: "London", country: "CA" });
  });

  it("refuse une ville inconnue, ou absente du pays choisi", async () => {
    render(<CreateHuntForm />);
    fireEvent.change(city(), { target: { value: "Nulleville" } });
    // Ville inconnue : la liste des pays s'ouvre.
    await waitFor(() => expect(country().options.length).toBeGreaterThan(1));
    fireEvent.change(country(), { target: { value: "FR" } });
    fillStep1AndNext();
    expect(await screen.findByText(/Ville introuvable/)).toBeInTheDocument();
    fireEvent.change(city(), { target: { value: "Marseille" } });
    fireEvent.click(await screen.findByRole("button", { name: "Modifier" }));
    fireEvent.change(country(), { target: { value: "BE" } });
    expect(await screen.findByText(/pas dans le pays choisi/)).toBeInTheDocument();
    // On reste à l'étape 1.
    expect(screen.queryByLabelText(/Date et heure limite/)).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("action en ligne : ni ville ni pays", async () => {
    render(<CreateHuntForm />);
    fireEvent.click(screen.getByRole("radio", { name: "En ligne" }));
    expect(screen.queryByLabelText("Ville")).toBeNull();
    expect(screen.queryByLabelText("Pays")).toBeNull();
    fillStep1AndNext();
    await fillStep2AndSubmit();
    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(getCreateHuntDraft()).toMatchObject({ location: ONLINE_LOCATION, country: "" });
  });
});
