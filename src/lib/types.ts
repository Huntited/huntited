// Types partagés du protocole Huntited.
// Un "Hunt" (chasse) décrit une action collective à coordonner.

/** États UI d'une chasse. */
export type HuntStatus = "draft" | "active" | "activated" | "expired" | "settled";

export interface Hunt {
  /** Identifiant unique de la chasse (mock pour l'instant) */
  id: string;
  /** Titre court de l'action */
  title: string;
  /** Description détaillée de l'action collective */
  description: string;
  /** Lieu, en texte libre (aucune donnée de géoloc collectée) */
  location: string;
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
  /** Valeur brute du champ datetime-local */
  deadline: string;
  threshold: number;
  /** Montants fixes, affichés en lecture seule dans le MVP. */
  deposit: number;
  commitDeposit: number;
}
