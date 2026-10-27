// Formulaire de création : un modèle préremplit, et « Annuler » rétablit.
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
// Absent de jsdom, utilisé par la case à cocher (Radix).
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

import { CreateHuntForm } from "@/components/hunt/CreateHuntForm";

describe("modèles dans le formulaire de création", () => {
  it("préremplit titre, description et seuil, puis annule", () => {
    render(<CreateHuntForm />);
    const title = screen.getByLabelText("Titre") as HTMLInputElement;
    fireEvent.change(title, { target: { value: "Mon idée" } });

    fireEvent.click(screen.getByRole("button", { name: /Rassemblement/ }));
    expect(title.value).toBe("Rassemblement pour [la cause] devant [lieu]");
    expect((screen.getByLabelText(/Description/) as HTMLTextAreaElement).value).toContain(
      "Rassemblement pacifique",
    );
    expect((screen.getByLabelText(/Seuil/) as HTMLInputElement).value).toBe("50");
    // Progression toujours masquée : plus de case à cocher.
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("Exemple « Rassemblement » chargé");
    expect(screen.getByText(/Conseillé pour cet exemple/)).toBeInTheDocument();
    // Seuil modifié : l'explication de l'exemple disparaît.
    fireEvent.change(screen.getByLabelText(/Seuil/), { target: { value: "60" } });
    expect(screen.queryByText(/Conseillé pour cet exemple/)).toBeNull();
    expect(screen.getByRole("button", { name: /Rassemblement/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // Changer de modèle puis annuler : retour aux valeurs d'avant le premier modèle.
    fireEvent.click(screen.getByRole("button", { name: /Nettoyage/ }));
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(title.value).toBe("Mon idée");
    expect(screen.queryByRole("status")).toBeNull();
  });
});
