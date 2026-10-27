import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SettlementSimulator } from "@/components/hunt/SettlementSimulator";

const mode = vi.hoisted(() => ({ value: "local" }));
vi.mock("@/lib/hunt-repository", () => ({ getDataMode: () => mode.value }));

// Absent de jsdom, utilisé par le curseur (Radix).
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
afterEach(() => cleanup());

const cardValue = (label: string) =>
  screen.getByText(label).parentElement!.querySelector("p:nth-of-type(2)")!.textContent;

describe("simulation avant de créer ou de s'engager", () => {
  it("créateur : ce qui est rendu si l'action a lieu, et sinon", () => {
    render(<SettlementSimulator role="creator" cautionKas={30} threshold={7} />);
    expect(cardValue("Action réussie")).toBe("22,25 KAS");
    expect(screen.getByText("rendus · 1 KAS par engagé·e")).toBeTruthy();
    expect(cardValue("Action annulée")).toBe("29 KAS");
  });

  it("créateur : la barre règle le seuil du formulaire, et le suit", () => {
    const changes: number[] = [];
    const { rerender } = render(
      <SettlementSimulator
        role="creator"
        cautionKas={30}
        threshold={7}
        onThresholdChange={(v) => changes.push(v)}
      />,
    );
    fireEvent.keyDown(screen.getByRole("slider"), { key: "ArrowRight" });
    expect(changes).toEqual([8]);
    fireEvent.click(screen.getByRole("button", { name: "50" }));
    expect(changes.at(-1)).toBe(50);
    rerender(<SettlementSimulator role="creator" cautionKas={30} threshold={100} />);
    // Le grand nombre et le cran de la barre suivent le seuil saisi.
    expect(screen.getByText("personnes minimum").previousElementSibling?.textContent).toBe("100");
    expect(screen.getByRole("button", { name: "100" }).className).toContain("font-semibold");
  });

  it("engagé·e : dépôt toujours rendu, récompense si l'action a lieu", () => {
    render(<SettlementSimulator role="participant" cautionKas={30} threshold={7} />);
    expect(cardValue("Rendu à toi")).toBe("5 KAS");
    expect(cardValue("Ta récompense")).toBe("+ 1 KAS");
  });

  it("engagé·e avec un seuil personnel plus haut : pas de récompense au seuil de l'action", () => {
    render(
      <SettlementSimulator
        role="participant"
        cautionKas={30}
        threshold={7}
        personalThreshold={10}
      />,
    );
    expect(cardValue("Ta récompense")).toBe("+ 0 KAS");
    expect(screen.getByText(/ton seuil \(10\) n'est pas atteint/)).toBeTruthy();
  });

  it("sur la blockchain : affiche le seul coût réel (inscription)", () => {
    mode.value = "chain";
    render(<SettlementSimulator role="creator" cautionKas={30} threshold={7} />);
    expect(screen.getByText(/Seul coût réel : 0,2 KAS pour inscrire l'action/)).toBeTruthy();
    mode.value = "local";
  });

  it("engagé·e : un de moins que le seuil, il manque 1 personne", () => {
    render(<SettlementSimulator role="participant" cautionKas={30} threshold={24} />);
    fireEvent.keyDown(screen.getByRole("slider"), { key: "ArrowLeft" });
    expect(screen.getByText("Il manque 1 personne : l'action n'a pas lieu.")).toBeTruthy();
  });
});
