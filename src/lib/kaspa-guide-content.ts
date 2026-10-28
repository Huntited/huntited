// Page « Débuter avec Kaspa » : ce que c'est, comment obtenir des KAS, les
// bonnes pratiques. Texte factuel, sans conseil d'investissement.
import type { Locale } from "./i18n";

export interface GuideSection {
  title: string;
  paragraphs: string[];
  /** Étapes numérotées (facultatif). */
  steps?: string[];
  links?: { label: string; href: string }[];
}

const FR: GuideSection[] = [
  {
    title: "Kaspa, en deux mots",
    paragraphs: [
      "Kaspa est une blockchain publique, un grand registre tenu par des milliers d'ordinateurs, sans entreprise au milieu.\nSa monnaie s'appelle le KAS.",
      "Huntited s'en sert comme d'un tableau d'affichage que personne ne peut effacer ni trafiquer.\nLes actions et les engagements y sont inscrits, et tout le monde peut vérifier le résultat. Pas besoin de faire confiance à un serveur Huntited, il n'y en a pas.",
    ],
  },
  {
    title: "Aujourd'hui : le réseau de test, gratuit",
    paragraphs: [
      "Pour l'instant Huntited tourne sur le réseau de test de Kaspa (Testnet 10).\nLes KAS de test sont gratuits et ne valent rien, tu peux tout essayer sans risque.",
    ],
    steps: [
      "Va sur « Mon wallet » et crée ton wallet en un clic, rien à installer.",
      "Note tes 12 mots sur papier et range-les bien.",
      "Clique « Recevoir des KAS de test gratuits », ton adresse est copiée et le distributeur s'ouvre.",
      "Colle ton adresse, valide, et les KAS arrivent en quelques secondes.",
      "Tu peux t'engager.",
    ],
    links: [
      { label: "Distributeur du réseau de test", href: "https://faucet-tn10.kaspanet.io/" },
      { label: "Kastle (wallet en extension, si tu préfères)", href: "https://kastle.cc/" },
    ],
  },
  {
    title: "Plus tard : de vrais KAS",
    paragraphs: [
      "Quand Huntited passera sur le vrai réseau, il faudra de vrais KAS.\nTrois façons courantes d'en avoir : une plateforme d'échange (qui demande en général une pièce d'identité), un achat entre particuliers, ou un proche qui t'en envoie.",
      "Le prix du KAS bouge beaucoup, et Huntited ne donne aucun conseil d'investissement.\nPrends seulement ce dont tu as besoin pour tes engagements.",
      "Tu es dans un syndicat, une association ou un collectif ?\nAvec le pass d'organisation, elle t'ouvre ses actions et tu t'engages sans wallet ni KAS.",
    ],
  },
  {
    title: "Ce que ça coûte",
    paragraphs: [
      "S'engager : 0,2 KAS pour inscrire ton engagement sur la blockchain (pas rendus), plus un dépôt de 5 KAS rendu à la fin.\nCréer une action : 0,2 KAS d'inscription et une caution, dont une partie récompense les participants et Huntited.",
      "Pour l'instant le dépôt et la caution sont simulés, seuls les 0,2 KAS de test partent vraiment.",
    ],
  },
  {
    title: "Les bons réflexes",
    paragraphs: [
      "Tes 12 mots, c'est la clé de ton wallet.\nGarde-les hors ligne, ne les tape que dans ton wallet (Huntited ou Kastle) et ne les donne à personne. Huntited ne te les demandera jamais.",
      "Tes engagements sont publics sur la blockchain, avec l'adresse de ton wallet.\nPour rester discret, garde un wallet rien que pour Huntited, rempli directement depuis l'extérieur plutôt que depuis ton compte principal.",
      "Avant d'envoyer, vérifie le montant et la destination : l'adresse du registre Huntited, pour 0,2 KAS.",
    ],
  },
];

const EN: GuideSection[] = [
  {
    title: "Kaspa in a nutshell",
    paragraphs: [
      "Kaspa is a public blockchain: a big ledger kept by thousands of computers, with no company in the middle. Its currency is called KAS.",
      "Huntited uses it as a notice board nobody can erase or forge: actions and commitments are written on it, and anyone can check the result. So there's no Huntited server you have to trust.",
    ],
  },
  {
    title: "Today: the free test network",
    paragraphs: [
      "Huntited currently runs on Kaspa's test network (Testnet 10). Test KAS are free and worthless: you can try everything without risk.",
    ],
    steps: [
      "Go to “My wallet” and create your wallet in one click, nothing to install.",
      "Write your 12 words down on paper and keep them safe.",
      "Click “Get free test KAS”: your address is copied and the faucet opens.",
      "Paste your address, confirm, and the KAS arrive within seconds.",
      "You're ready to commit.",
    ],
    links: [
      { label: "Test network faucet", href: "https://faucet-tn10.kaspanet.io/" },
      { label: "Kastle (extension wallet, if you prefer)", href: "https://kastle.cc/" },
    ],
  },
  {
    title: "Later: real KAS",
    paragraphs: [
      "When Huntited moves to the main network, you'll need real KAS. Three common ways to get some: an exchange (usually asking for an ID), a person-to-person purchase, or a transfer from someone who already has some.",
      "The KAS price varies a lot. Huntited gives no investment advice: only get what you need for your commitments.",
      "Member of a union, an association or a collective? With the organisation pass, it opens its actions to you: you commit with no wallet or KAS.",
    ],
  },
  {
    title: "What it costs",
    paragraphs: [
      "Committing: 0.2 KAS to write the commitment on the blockchain (not returned), plus a 5 KAS deposit returned at the end. Creating an action: 0.2 KAS to register it and a deposit, part of which rewards participants and Huntited.",
      "For now, deposits are simulated: only the 0.2 test KAS are actually sent.",
    ],
  },
  {
    title: "Good habits",
    paragraphs: [
      "Your 12 words are your wallet's key: keep them offline, only type them into your wallet (Huntited or Kastle), never give them to anyone. Huntited will never ask for them.",
      "Your commitments are public on the blockchain, with your wallet address. To stay discreet, keep a wallet just for Huntited, funded directly from outside rather than from your main account.",
      "Before sending, check the amount and destination: the Huntited registry address, for 0.2 KAS.",
    ],
  },
];

export const kaspaGuide = (locale: Locale): GuideSection[] => (locale === "fr" ? FR : EN);
