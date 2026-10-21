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
  it("créateur : au seuil, ce qui est rendu et ce qui est versé", () => {
    render(<SettlementSimulator role="creator" cautionKas={30} threshold={7} />);
    expect(screen.getByText(/l'action a lieu/)).toBeTruthy();
    expect(cardValue("Ta caution")).toBe("30 KAS");
    expect(cardValue("Rendu à toi")).toBe("22,25 KAS");
    expect(cardValue("Versé aux engagé·es")).toBe("7 KAS");
    expect(screen.getByText("0,75 KAS vont à Huntited")).toBeTruthy();
  });

  it("engagé·e : dépôt toujours rendu, récompense si l'action a lieu", () => {
    render(<SettlementSimulator role="participant" cautionKas={30} threshold={7} />);
    expect(cardValue("Rendu à toi")).toBe("5 KAS");
    expect(cardValue("Ta récompense")).toBe("+ 1 KAS");
  });

  it("engagé·e avec un seuil personnel plus haut : pas de récompense au seuil de la chasse", () => {
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
    expect(screen.getByText(/Seul coût réel : 0,2 KAS/)).toBeTruthy();
    mode.value = "local";
  });

  it("un de moins que le seuil : il manque 1 personne ; le curseur suit un nouveau seuil", () => {
    const { rerender } = render(
      <SettlementSimulator role="creator" cautionKas={1000} threshold={24} />,
    );
    fireEvent.keyDown(screen.getByRole("slider"), { key: "ArrowLeft" });
    expect(screen.getByText("Il manque 1 personne : l'action n'a pas lieu.")).toBeTruthy();
    rerender(<SettlementSimulator role="creator" cautionKas={1000} threshold={30} />);
    expect(screen.getByRole("slider").getAttribute("aria-valuenow")).toBe("30");
    expect(screen.getByText(/l'action a lieu/)).toBeTruthy();
  });
});
