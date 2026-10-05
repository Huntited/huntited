// Registre des chasses : point d'entrée unique pour lister/lire les chasses.
// Aujourd'hui : démos + chasses créées localement (via covenants.ts).
// Demain : indexeur on-chain Kaspa — seule cette couche changera.

import {
  getCovenantStatus,
  getHunt,
  getRetainedGroup,
  listHunts,
  type CovenantStatus,
} from "./covenants";
import type { HuntView } from "./hunt-repository";
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
      // Activation : taille du groupe retenu (seuils personnels).
      commitCount: getRetainedGroup(hunt).retainedCount,
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

/** Statut de filtre d'une vue : une chasse résolue compte selon son issue. */
function filterStatus(v: HuntView): CovenantStatus {
  if (v.status === "settled") return v.outcome === "failure" ? "expired" : "activated";
  return v.status === "draft" ? "active" : v.status;
}

/** Filtre et trie des vues (deadline la plus proche d'abord). */
export function filterHuntViews(views: HuntView[], filters: HuntFilters = {}): HuntView[] {
  const q = filters.search?.trim().toLowerCase();
  return views
    .filter((v) => !filters.status || filterStatus(v) === filters.status)
    .filter(
      (v) =>
        !q ||
        [v.hunt.title, v.hunt.description, v.hunt.location].some((t) =>
          t.toLowerCase().includes(q),
        ),
    )
    .sort((a, b) => new Date(a.hunt.deadline).getTime() - new Date(b.hunt.deadline).getTime());
}

/** Lecture d'une chasse par identifiant. */
export function getHuntById(id: string): Hunt | undefined {
  return getHunt(id);
}
