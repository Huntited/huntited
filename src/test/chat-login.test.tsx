import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ChatLoginBox } from "@/components/hunt/ChatLoginBox";

afterEach(() => cleanup());

const login = {
  clientUrl: "https://chat.huntited.test",
  homeserverUrl: "https://matrix.huntited.test",
  username: "@h0123456789abcdef:huntited.test",
  password: "mot-de-passe-temporaire",
};

describe("identifiants temporaires du chat", () => {
  it("affiche l'identifiant, masque le mot de passe jusqu'à la demande", () => {
    render(<ChatLoginBox login={login} />);
    expect(screen.getByText(login.username)).toBeTruthy();
    expect(screen.queryByText(login.password)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Afficher" }));
    expect(screen.getByText(login.password)).toBeTruthy();
    expect(screen.getByText(/supprimé avec le salon/)).toBeTruthy();
  });
});
