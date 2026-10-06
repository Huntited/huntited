// Modèles de chasse : un point de départ prêt à remplir, avec un seuil et
// une durée conseillés. Les passages [entre crochets] sont à remplacer
// (la validation refuse de créer une chasse qui en contient encore).
import type { Locale } from "./i18n";

export interface HuntTemplate {
  id: string;
  emoji: string;
  /** Seuil conseillé (≥ 7, le minimum d'une chasse). */
  threshold: number;
  /** Durée conseillée avant la date limite, en jours. */
  days: number;
  /** Progression masquée conseillée (protège les premiers engagés). */
  hideProgress: boolean;
}

export interface TemplateText {
  name: string;
  title: string;
  description: string;
  /** Pourquoi ce seuil (affiché après application). */
  why: string;
}

export const HUNT_TEMPLATES: HuntTemplate[] = [
  { id: "cleanup", emoji: "🧹", threshold: 10, days: 14, hideProgress: false },
  { id: "rally", emoji: "📣", threshold: 50, days: 21, hideProgress: true },
  { id: "boycott", emoji: "🛑", threshold: 200, days: 30, hideProgress: true },
  { id: "letter", emoji: "✉️", threshold: 30, days: 14, hideProgress: false },
  { id: "shop", emoji: "🛒", threshold: 25, days: 21, hideProgress: false },
  { id: "work", emoji: "🤝", threshold: 7, days: 14, hideProgress: true },
  { id: "repair", emoji: "🔧", threshold: 8, days: 10, hideProgress: false },
];

const TEXTS: Record<Locale, Record<string, TemplateText>> = {
  fr: {
    cleanup: {
      name: "Nettoyage",
      title: "Nettoyons [le parc, la plage…] ensemble",
      description:
        "Rendez-vous le [date et heure] à [point de rendez-vous] pour ramasser les déchets pendant deux heures. Apporte des gants ; les sacs sont fournis par [qui].",
      why: "une dizaine de personnes suffit pour un résultat visible en deux heures.",
    },
    rally: {
      name: "Rassemblement",
      title: "Rassemblement pour [la cause] devant [lieu]",
      description:
        "Rassemblement pacifique le [date et heure] devant [lieu] pour demander [revendication précise]. Si la loi l'exige, le rassemblement sera déclaré en mairie ou en préfecture.",
      why: "en dessous d'une cinquantaine, un rassemblement passe inaperçu. La progression masquée protège les premiers engagés.",
    },
    boycott: {
      name: "Boycott",
      title: "Boycott de [enseigne ou produit] jusqu'à [revendication]",
      description:
        "À partir du [date], on arrête d'acheter [enseigne ou produit], jusqu'à ce que [revendication précise et vérifiable]. Seul·e, ça ne change rien ; ensemble, c'est un signal.",
      why: "un boycott ne pèse que s'il est massif. La progression masquée évite de décourager au début.",
    },
    letter: {
      name: "Lettre collective",
      title: "Lettre collective à [élu·e ou institution] sur [sujet]",
      description:
        "Le [date], chaque personne engagée envoie la même lettre à [destinataire] pour demander [demande précise]. Le texte sera partagé dans le chat dès que la chasse se déclenche.",
      why: "une trentaine de lettres le même jour se remarque et oblige à répondre.",
    },
    shop: {
      name: "Demande à un commerce",
      title: "Demandons à [commerce] de [proposer le vrac, ouvrir le dimanche…]",
      description:
        "Si on est assez, on va voir [commerce] ensemble le [date] pour demander [demande], en montrant qu'une clientèle est prête à suivre.",
      why: "quelques dizaines de clients prêts à suivre, c'est un argument concret pour un commerce.",
    },
    work: {
      name: "Demande au travail",
      title: "Demande collective à [direction ou service] sur [sujet]",
      description:
        "Si on est assez, on porte ensemble la demande suivante à [direction ou service] : [demande précise]. Personne n'y va seul·e : tant que le seuil n'est pas atteint, personne ne sait qui s'est engagé.",
      why: "le minimum suffit souvent dans une équipe. La progression masquée évite d'exposer qui que ce soit avant le seuil.",
    },
    repair: {
      name: "Atelier de quartier",
      title: "Atelier de réparation à [quartier]",
      description:
        "On se retrouve le [date et heure] à [lieu] pour réparer ensemble vélos, petits appareils et vêtements. Apporte tes outils ou un objet à réparer.",
      why: "huit personnes suffisent pour un atelier convivial et utile.",
    },
  },
  en: {
    cleanup: {
      name: "Clean-up",
      title: "Let's clean up [the park, the beach…] together",
      description:
        "Meet on [date and time] at [meeting point] to pick up litter for two hours. Bring gloves; bags provided by [who].",
      why: "about ten people is enough for a visible result in two hours.",
    },
    rally: {
      name: "Rally",
      title: "Rally for [the cause] in front of [place]",
      description:
        "Peaceful rally on [date and time] in front of [place] to ask for [specific demand]. If the law requires it, the rally will be declared to the local authorities.",
      why: "below about fifty people, a rally goes unnoticed. Hidden progress protects the first people to commit.",
    },
    boycott: {
      name: "Boycott",
      title: "Boycott [brand or product] until [demand]",
      description:
        "From [date], we stop buying [brand or product] until [specific, verifiable demand]. Alone it changes nothing; together it's a signal.",
      why: "a boycott only matters if it's massive. Hidden progress avoids discouraging people early on.",
    },
    letter: {
      name: "Collective letter",
      title: "Collective letter to [official or institution] about [topic]",
      description:
        "On [date], everyone who committed sends the same letter to [recipient] asking for [specific request]. The text will be shared in the chat as soon as the hunt triggers.",
      why: "thirty letters on the same day get noticed and call for an answer.",
    },
    shop: {
      name: "Ask a local shop",
      title: "Let's ask [shop] to [offer bulk goods, open on Sundays…]",
      description:
        "If there are enough of us, we'll go to [shop] together on [date] to ask for [request], showing that customers are ready to follow.",
      why: "a few dozen customers ready to follow is a concrete argument for a shop.",
    },
    work: {
      name: "Request at work",
      title: "Collective request to [management or department] about [topic]",
      description:
        "If there are enough of us, we'll bring this request to [management or department] together: [specific request]. Nobody goes alone: until the threshold is reached, nobody knows who committed.",
      why: "the minimum is often enough within a team. Hidden progress avoids exposing anyone before the threshold.",
    },
    repair: {
      name: "Neighbourhood workshop",
      title: "Repair workshop in [neighbourhood]",
      description:
        "Let's meet on [date and time] at [place] to fix bikes, small appliances and clothes together. Bring your tools or something to repair.",
      why: "eight people is enough for a friendly, useful workshop.",
    },
  },
};

export function templateText(id: string, locale: Locale): TemplateText {
  return TEXTS[locale][id] ?? TEXTS.fr[id]!;
}

/** Un passage [à remplacer] reste dans le texte. */
export function hasPlaceholder(text: string): boolean {
  return /\[[^\]\n]{1,80}\]/.test(text);
}

/** Date limite conseillée : dans `days` jours, à 20 h (format datetime-local). */
export function suggestedDeadline(days: number, now: Date = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  d.setHours(20, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T20:00`;
}
