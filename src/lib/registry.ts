// Registre des chasses : point d'entrée unique pour lister/lire les chasses.
// Aujourd'hui : démos + chasses créées localement (via covenants.ts).
// Demain : indexeur on-chain Kaspa — seule cette couche changera.

import {
  getCovenantStatus,
  getCommitCount,
  getHunt,
  listHunts,
  type CovenantStatus,
} from "./covenants";
import type { Hunt } from "./types";

export interface HuntFilters {
  /** Ne garder que les chasses dans ce statut */
  status?: CovenantStatus;
  /** Recherche plein texte (titre, description, lieu), insensible à la casse */
  search?: string;
}

/** Statut courant d'une chasse (deadline + compteur). */
export function getHuntStatus(hunt: Hunt, now = Date.now()): CovenantStatus {
  return getCovenantStatus(
    {
      deadline: new Date(hunt.deadline).getTime(),
      commitCount: getCommitCount(hunt),
      threshold: hunt.threshold,
    },
    now,
  );
}

/** Liste des chasses, filtrées et triées par deadline la plus proche. */
export function getHunts(filters: HuntFilters = {}): Hunt[] {
  const q = filters.search?.trim().toLowerCase();
  return listHunts()
    .filter((h) => !filters.status || getHuntStatus(h) === filters.status)
    .filter(
      (h) => !q || [h.title, h.description, h.location].some((t) => t.toLowerCase().includes(q)),
    )
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
}

/** Lecture d'une chasse par identifiant. */
export function getHuntById(id: string): Hunt | undefined {
  return getHunt(id);
}
