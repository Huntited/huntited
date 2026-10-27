// Modèles de chasse : un point de départ prêt à remplir, avec un seuil et
// une durée conseillés. Les passages [entre crochets] sont à remplacer
// (la validation refuse de créer une chasse qui en contient encore).
import type { Locale } from "./i18n";

export interface HuntTemplate {
  id: string;
  /** Seuil conseillé (≥ 7, le minimum d'une chasse). */
  threshold: number;
  /** Durée conseillée avant la date limite, en jours. */
  days: number;
  /** Action en ligne (ni ville ni pays). */
  online?: boolean;
}

export interface TemplateText {
  name: string;
  title: string;
  description: string;
  /** Pourquoi ce seuil (affiché après application). */
  why: string;
}

export const HUNT_TEMPLATES: HuntTemplate[] = [
  { id: "cleanup", threshold: 10, days: 14 },
  { id: "rally", threshold: 50, days: 21 },
  { id: "boycott", threshold: 200, days: 30 },
  { id: "letter", threshold: 30, days: 14 },
  { id: "shop", threshold: 25, days: 21 },
  { id: "work", threshold: 7, days: 14 },
  { id: "repair", threshold: 8, days: 10 },
  { id: "post", threshold: 100, days: 14, online: true },
  { id: "email", threshold: 30, days: 10, online: true },
  { id: "switch", threshold: 50, days: 30, online: true },
  { id: "together", threshold: 20, days: 21 },
  { id: "speak", threshold: 7, days: 21 },
  { id: "launch", threshold: 30, days: 30 },
];

const TEXTS: Record<Locale, Record<string, TemplateText>> = {
  fr: {
    cleanup: {
      name: "Nettoyage",
      title: "Nettoyons [le parc, la plage…] ensemble",
      description:
        "Rendez-vous le [date et heure] à [point de rendez-vous] pour ramasser les déchets pendant deux heures. Apporte des gants ; les sacs sont fournis par [qui].",
      why: "une dizaine suffit pour un résultat visible.",
    },
    rally: {
      name: "Rassemblement",
      title: "Rassemblement pour [la cause] devant [lieu]",
      description:
        "Rassemblement pacifique le [date et heure] devant [lieu] pour demander [revendication précise]. Si la loi l'exige, le rassemblement sera déclaré en mairie ou en préfecture.",
      why: "en dessous, un rassemblement passe inaperçu.",
    },
    boycott: {
      name: "Boycott",
      title: "Boycott de [enseigne ou produit] jusqu'à [revendication]",
      description:
        "À partir du [date], on arrête d'acheter [enseigne ou produit], jusqu'à ce que [revendication précise et vérifiable]. Seul·e, ça ne change rien ; ensemble, c'est un signal.",
      why: "un boycott ne pèse que s'il est massif.",
    },
    letter: {
      name: "Lettre collective",
      title: "Lettre collective à [élu·e ou institution] sur [sujet]",
      description:
        "Le [date], chaque personne engagée envoie la même lettre à [destinataire] pour demander [demande précise]. Le texte sera partagé dans le chat dès que l'action se déclenche.",
      why: "trente lettres le même jour, ça se remarque.",
    },
    shop: {
      name: "Commerce local",
      title: "Demandons à [commerce] de [proposer le vrac, ouvrir le dimanche…]",
      description:
        "Si on est assez, on va voir [commerce] ensemble le [date] pour demander [demande], en montrant qu'une clientèle est prête à suivre.",
      why: "assez pour peser face au commerçant.",
    },
    work: {
      name: "Au travail",
      title: "Demande collective à [direction ou service] sur [sujet]",
      description:
        "Si on est assez, on porte ensemble la demande suivante à [direction ou service] : [demande précise]. Personne n'y va seul·e : tant que le seuil n'est pas atteint, personne ne sait qui s'est engagé.",
      why: "le minimum suffit souvent dans une équipe.",
    },
    repair: {
      name: "Atelier de réparation",
      title: "Atelier de réparation à [quartier]",
      description:
        "On se retrouve le [date et heure] à [lieu] pour réparer ensemble vélos, petits appareils et vêtements. Apporte tes outils ou un objet à réparer.",
      why: "assez pour un atelier vivant.",
    },
    post: {
      name: "Publication collective",
      title: "Publions tous le même message sur [réseau] pour [cause]",
      description:
        "Le [date et heure], chaque personne engagée publie le même message sur [réseau] pour [objectif]. Le texte sera partagé dans le chat dès que l'action se déclenche. Un message respectueux, une seule fois : jamais de harcèlement.",
      why: "une centaine de messages au même moment, ça se remarque.",
    },
    email: {
      name: "Courriels collectifs",
      title: "Écrivons tous à [destinataire] sur [sujet]",
      description:
        "Le [date], chaque personne engagée envoie un courriel à [destinataire] pour demander [demande précise]. Le modèle de texte sera partagé dans le chat. Un message poli, une seule fois par personne.",
      why: "une trentaine de courriels le même jour obligent à répondre.",
    },
    switch: {
      name: "Changer d'appli ensemble",
      title: "On quitte [appli ou plateforme] pour [autre appli] ensemble",
      description:
        "Beaucoup voudraient quitter [appli ou plateforme], mais personne ne part seul : on perdrait le contact avec les autres. Si on est assez, on passe tous à [autre appli] le [date], et on s'y retrouve.",
      why: "assez pour que la nouvelle appli soit vivante dès le premier jour.",
    },
    together: {
      name: "Achat ou abonnement groupé",
      title: "On s'abonne à [service, producteur, panier…] si on est assez",
      description:
        "[Service ou producteur] peut démarrer à [lieu] s'il a au moins [nombre] clients. Chaque personne engagée s'abonne le [date] ; si on n'est pas assez, personne ne s'abonne.",
      why: "le minimum dont le service a besoin pour démarrer.",
    },
    speak: {
      name: "Prendre la parole",
      title: "Témoignons ensemble sur [sujet] si on est assez",
      description:
        "Parler seul·e de [sujet] expose trop. Si on est assez, chaque personne engagée témoigne le [date] [où et comment]. Tant que le seuil n'est pas atteint, personne ne sait qui s'est engagé.",
      why: "le minimum suffit souvent : on n'est plus seul·e.",
    },
    launch: {
      name: "Lancer un projet",
      title: "Je lance [projet ou service] si [nombre] personnes suivent",
      description:
        "Je suis prêt·e à lancer [projet ou service] à [lieu] le [date], à condition d'avoir au moins [nombre] premiers participants ou clients. Engage-toi : si on n'est pas assez, rien ne démarre et personne n'est engagé.",
      why: "le nombre dont le projet a besoin pour tenir.",
    },
  },
  en: {
    cleanup: {
      name: "Clean-up",
      title: "Let's clean up [the park, the beach…] together",
      description:
        "Meet on [date and time] at [meeting point] to pick up litter for two hours. Bring gloves; bags provided by [who].",
      why: "about ten is enough for a visible result.",
    },
    rally: {
      name: "Rally",
      title: "Rally for [the cause] in front of [place]",
      description:
        "Peaceful rally on [date and time] in front of [place] to ask for [specific demand]. If the law requires it, the rally will be declared to the local authorities.",
      why: "any fewer and a rally goes unnoticed.",
    },
    boycott: {
      name: "Boycott",
      title: "Boycott [brand or product] until [demand]",
      description:
        "From [date], we stop buying [brand or product] until [specific, verifiable demand]. Alone it changes nothing; together it's a signal.",
      why: "a boycott only matters if it's massive.",
    },
    letter: {
      name: "Collective letter",
      title: "Collective letter to [official or institution] about [topic]",
      description:
        "On [date], everyone who committed sends the same letter to [recipient] asking for [specific request]. The text will be shared in the chat as soon as the action triggers.",
      why: "thirty letters on the same day get noticed.",
    },
    shop: {
      name: "Local shop",
      title: "Let's ask [shop] to [offer bulk goods, open on Sundays…]",
      description:
        "If there are enough of us, we'll go to [shop] together on [date] to ask for [request], showing that customers are ready to follow.",
      why: "enough to carry weight with the shop.",
    },
    work: {
      name: "At work",
      title: "Collective request to [management or department] about [topic]",
      description:
        "If there are enough of us, we'll bring this request to [management or department] together: [specific request]. Nobody goes alone: until the threshold is reached, nobody knows who committed.",
      why: "the minimum is often enough within a team.",
    },
    repair: {
      name: "Repair workshop",
      title: "Repair workshop in [neighbourhood]",
      description:
        "Let's meet on [date and time] at [place] to fix bikes, small appliances and clothes together. Bring your tools or something to repair.",
      why: "enough for a lively workshop.",
    },
    post: {
      name: "Collective post",
      title: "Let's all post the same message on [network] for [cause]",
      description:
        "On [date and time], everyone who committed posts the same message on [network] for [goal]. The text will be shared in the chat as soon as the action triggers. A respectful message, once: never harassment.",
      why: "a hundred messages at the same moment get noticed.",
    },
    email: {
      name: "Collective emails",
      title: "Let's all write to [recipient] about [topic]",
      description:
        "On [date], everyone who committed sends an email to [recipient] asking for [specific request]. The template will be shared in the chat. A polite message, once per person.",
      why: "thirty emails on the same day call for an answer.",
    },
    switch: {
      name: "Switch apps together",
      title: "Let's leave [app or platform] for [other app] together",
      description:
        "Many would like to leave [app or platform], but nobody leaves alone: we'd lose touch with everyone else. If there are enough of us, we all move to [other app] on [date] and meet there.",
      why: "enough for the new app to feel alive on day one.",
    },
    together: {
      name: "Group purchase or subscription",
      title: "We subscribe to [service, producer, box…] if there are enough of us",
      description:
        "[Service or producer] can start in [place] with at least [number] customers. Everyone who committed subscribes on [date]; if there aren't enough of us, nobody subscribes.",
      why: "the minimum the service needs to start.",
    },
    speak: {
      name: "Speak up",
      title: "Let's speak up together about [topic] if there are enough of us",
      description:
        "Speaking alone about [topic] is too risky. If there are enough of us, everyone who committed speaks up on [date] [where and how]. Until the threshold is reached, nobody knows who committed.",
      why: "the minimum is often enough: you're no longer alone.",
    },
    launch: {
      name: "Launch a project",
      title: "I'll launch [project or service] if [number] people follow",
      description:
        "I'm ready to launch [project or service] in [place] on [date], as long as at least [number] first participants or customers join. Commit: if there aren't enough of us, nothing starts and nobody is bound.",
      why: "the number the project needs to last.",
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
