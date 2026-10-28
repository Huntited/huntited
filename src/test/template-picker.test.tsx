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

describe("idées dans le formulaire de création", () => {
  it("préremplit titre, description et seuil, puis annule", () => {
    render(<CreateHuntForm />);
    const title = screen.getByLabelText("Titre") as HTMLInputElement;
    fireEvent.change(title, { target: { value: "Mon idée" } });

    fireEvent.click(screen.getByRole("button", { name: /Changer d'appli ensemble/ }));
    expect(title.value).toBe("On quitte [appli ou plateforme] pour [autre appli] ensemble");
    expect((screen.getByLabelText(/Description/) as HTMLTextAreaElement).value).toContain(
      "Beaucoup voudraient quitter",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Exemple « Changer d'appli ensemble » chargé",
    );

    // Les passages [entre crochets] doivent être remplacés avant de continuer.
    fireEvent.click(screen.getByRole("button", { name: "Suivant" }));
    expect(screen.queryByLabelText("Personnes nécessaires", { selector: "#threshold" })).toBeNull();
    fireEvent.change(title, { target: { value: "On quitte X pour Y ensemble" } });
    fireEvent.change(screen.getByLabelText(/Description/), {
      target: { value: "Beaucoup voudraient quitter X : on passe tous à Y le 1er mai." },
    });

    // Étape 2 : seuil conseillé, et son explication tant qu'il n'est pas modifié.
    fireEvent.click(screen.getByRole("button", { name: "Suivant" }));
    expect(
      (
        screen.getByLabelText("Personnes nécessaires", {
          selector: "#threshold",
        }) as HTMLInputElement
      ).value,
    ).toBe("50");
    expect(screen.getByText(/Conseillé pour cet exemple/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Personnes nécessaires", { selector: "#threshold" }), {
      target: { value: "60" },
    });
    expect(screen.queryByText(/Conseillé pour cet exemple/)).toBeNull();
    // Progression toujours masquée : plus de case à cocher.
    expect(screen.queryByRole("checkbox")).toBeNull();

    // Retour à l'étape 1 : l'idée choisie est toujours marquée.
    fireEvent.click(screen.getByRole("button", { name: "Retour" }));
    expect(screen.getByRole("button", { name: /Changer d'appli ensemble/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // Changer d'idée puis annuler : retour aux valeurs d'avant la première idée.
    fireEvent.click(screen.getByRole("button", { name: /Nettoyage/ }));
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect((screen.getByLabelText("Titre") as HTMLInputElement).value).toBe("Mon idée");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("six idées d'abord, les autres sur demande", () => {
    render(<CreateHuntForm />);
    expect(screen.queryByRole("button", { name: /Rassemblement/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Plus d'idées" }));
    expect(screen.getByRole("button", { name: /Rassemblement/ })).toBeInTheDocument();
  });
});
