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
  it("préremplit titre, description, seuil et masquage, puis annule", () => {
    render(<CreateHuntForm />);
    const title = screen.getByLabelText("Titre") as HTMLInputElement;
    fireEvent.change(title, { target: { value: "Mon idée" } });

    fireEvent.click(screen.getByRole("button", { name: /Rassemblement/ }));
    expect(title.value).toBe("Rassemblement pour [la cause] devant [lieu]");
    expect((screen.getByLabelText(/Description/) as HTMLTextAreaElement).value).toContain(
      "Rassemblement pacifique",
    );
    expect((screen.getByLabelText(/Seuil/) as HTMLInputElement).value).toBe("50");
    expect(screen.getByRole("checkbox")).toHaveAttribute("data-state", "checked");
    expect(screen.getByRole("status")).toHaveTextContent("Seuil conseillé : 50");
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
