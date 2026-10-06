import type { Hunt } from "./types";

// Données mockées pour le MVP front. Remplacées plus tard par des lectures
// on-chain (contrat Kaspa) — aucune donnée personnelle ici.

const MOCK_HUNTS: Record<string, Hunt> = {
  demo: {
    id: "demo",
    title: "Rassemblement place de la République",
    description:
      "Rassemblement statique et pacifique. Point de rendez-vous communiqué aux participants engagés après déclenchement. Apportez de l'eau et restez mobiles.",
    location: "Paris, place de la République",
    country: "FR",
    deadline: "2026-10-10T18:00:00Z",
    threshold: 50,
    deposit: 30,
    commitDeposit: 5,
    commitCount: 12,
    status: "active",
  },
  sol: {
    id: "sol",
    title: "Distribution solidaire — secteur nord",
    description:
      "Distribution de repas et de couvertures. Engagement anonyme, coordination sur place le jour J uniquement.",
    location: "Lille, gare Lille-Flandres",
    country: "FR",
    deadline: "2026-10-18T09:00:00Z",
    threshold: 20,
    deposit: 30,
    commitDeposit: 5,
    commitCount: 7,
    status: "active",
  },
};

/** Liste plate des chasses mockées (utilisable avec .find / .filter). */
export const mockHunts: Hunt[] = Object.values(MOCK_HUNTS);

/**
 * Retourne une chasse mockée pour l'identifiant demandé.
 * Si l'identifiant est inconnu, on génère une chasse générique (MVP).
 */
export function getMockHunt(id: string): Hunt {
  const known = MOCK_HUNTS[id];
  if (known) return known;

  return {
    id,
    title: "Chasse (brouillon de démonstration)",
    description:
      "Ceci est une chasse de démonstration : les données réelles viendront du contrat Kaspa.",
    location: "Lieu à définir",
    deadline: "2026-11-01T12:00:00Z",
    threshold: 25,
    deposit: 30,
    commitDeposit: 5,
    commitCount: 3,
    status: "active",
  };
}
