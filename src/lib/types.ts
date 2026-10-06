// Types partagés du protocole Huntited.
// Un "Hunt" (chasse) décrit une action collective à coordonner.

/** États UI d'une chasse. */
export type HuntStatus = "draft" | "active" | "activated" | "expired" | "settled";

/**
 * Visibilité de la progression pendant la phase d'engagement :
 * - "visible" : le compteur d'engagements est affiché à tous ;
 * - "hidden"  : personne ne voit le compteur avant l'activation ou la date limite.
 * Dans le prototype, "hidden" est un masquage d'affichage, pas une garantie
 * cryptographique.
 */
export type ProgressVisibility = "visible" | "hidden";

export interface Hunt {
  /** Identifiant unique de la chasse (mock pour l'instant) */
  id: string;
  /** Titre court de l'action */
  title: string;
  /** Description détaillée de l'action collective */
  description: string;
  /** Lieu, en texte libre (aucune donnée de géoloc collectée) */
  location: string;
  /** Pays (code ISO 3166-1 alpha-2) ; absent pour les anciennes chasses. */
  country?: string;
  /** Date/heure limite au format ISO — après quoi l'action est annulée */
  deadline: string;
  /** Nombre minimum d'engagements nécessaires pour déclencher l'action */
  threshold: number;
  /** Dépôt de création, en KAS (fixé à 30 pour le MVP) */
  deposit: number;
  /** Dépôt par engagement, en KAS (fixé à 5 pour le MVP) */
  commitDeposit: number;
  /** Nombre de participants déjà engagés (mock) */
  commitCount: number;
  /** Statut enregistré ; le statut affiché est dérivé par deriveHuntStatus(). */
  status: HuntStatus;
  /** Visibilité de la progression (absente = "visible"). */
  progressVisibility?: ProgressVisibility;
  /** Date d'activation (ISO), si connue. */
  activatedAt?: string;
  /** Date de résolution (ISO), si connue. */
  settledAt?: string;
}

/** Données saisies dans le formulaire de création (avant envoi au contrat). */
export interface HuntFormData {
  title: string;
  description: string;
  location: string;
  /** Pays (code ISO 3166-1 alpha-2). */
  country?: string;
  /** Valeur brute du champ datetime-local */
  deadline: string;
  threshold: number;
  /** Montants fixes, affichés en lecture seule dans le MVP. */
  deposit: number;
  commitDeposit: number;
  /** Visibilité de la progression choisie par le créateur (absente = "visible"). */
  progressVisibility?: ProgressVisibility;
}
