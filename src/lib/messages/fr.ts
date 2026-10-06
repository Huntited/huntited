// Textes de l'interface en français (langue de référence).
// Chaque clé doit exister aussi dans en.ts (vérifié par le typage).
export const fr = {
  // En-tête et navigation
  "nav.hunts": "Chasses",
  "nav.create": "Créer",
  "nav.myHunts": "Mes chasses",
  "nav.pass": "Mon pass",
  "nav.menu": "Menu",
  "nav.home": "Accueil Huntited",
  "lang.switch": "Langue",
  "wallet.connect": "Connecter le wallet",
  "wallet.connecting": "Connexion…",
  "wallet.disconnect": "Déconnecter",
  "footer.tagline": "Tout le monde ou personne. Aucune donnée personnelle.",
  "footer.testnet": "Version de test : aucun vrai KAS.",
  "dev.reset": "Réinitialiser les données de démonstration",
  "dev.resetConfirm": "Réinitialiser les données de démonstration Huntited ?",

  // Pages d'erreur
  "notFound.title": "Cette page n'existe pas",
  "notFound.text": "Le lien est peut-être incomplet, ou la chasse a été retirée.",
  "notFound.home": "Voir les chasses",
  "notFound.create": "Créer une chasse",
  "error.title": "Cette page n'a pas pu s'afficher",
  "error.text":
    "Un problème est survenu de notre côté. Réessaie, ou reviens à l'accueil. Rien n'a été envoyé ni engagé.",
  "error.retry": "Réessayer",
  "error.home": "Retour à l'accueil",
  "common.back": "← Retour",
  "common.loading": "Chargement…",

  // Statuts d'une chasse
  "status.draft": "Brouillon",
  "status.active": "En cours",
  "status.activated": "Seuil atteint",
  "status.expired": "Expirée",
  "status.settled": "Résolue",
  "status.aria": "Statut : {label}",

  // Accueil
  "home.title": "Agir ensemble, sans y aller seul",
  "home.lead":
    "Chacun s'engage en privé. L'action n'a lieu que si assez de monde suit ; sinon, tout le monde est remboursé.",
  "home.step1.title": "Une chasse",
  "home.step1.text": "Une action, un lieu, une date limite et un nombre minimum de personnes.",
  "home.step2.title": "Des engagements privés",
  "home.step2.text": "Chacun s'engage sans se montrer : personne ne prend de risque seul.",
  "home.step3.title": "Tout le monde ou personne",
  "home.step3.text": "Seuil atteint : l'action a lieu. Sinon, chacun récupère son dépôt.",
  "home.create": "Créer une chasse",
  "home.search": "Rechercher une chasse…",
  "home.filter": "Filtrer par statut",
  "home.filter.all": "Toutes",
  "home.filter.active": "En cours",
  "home.filter.activated": "Déclenchées",
  "home.filter.expired": "Terminées",
  "home.section.all": "Toutes les chasses",
  "home.section.active": "Chasses en cours",
  "home.section.activated": "Chasses déclenchées",
  "home.section.expired": "Chasses terminées",
  "home.section.results": "Résultats",
  "home.loadError": "Impossible de charger les chasses pour le moment. Réessaie plus tard.",
  "home.noMatch": "Aucune chasse ne correspond à ces filtres.",
  "home.empty": "Aucune chasse pour le moment. Lance la première !",
  "home.card.before": "avant le {date}",
  "home.card.progress": "{count} sur {threshold} engagés",
  "home.card.hidden": "Seuil : {threshold} · progression masquée",
} as const;

export type Messages = Record<keyof typeof fr, string>;
