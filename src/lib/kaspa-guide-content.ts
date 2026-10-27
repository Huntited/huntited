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
      "Kaspa est une blockchain publique : un grand registre tenu par des milliers d'ordinateurs, sans entreprise au centre. Sa monnaie s'appelle le KAS.",
      "Huntited s'en sert comme d'un tableau d'affichage que personne ne peut effacer ni falsifier : les actions et les engagements y sont inscrits, et tout le monde peut vérifier le résultat. Il n'y a donc pas de serveur Huntited à qui faire confiance.",
    ],
  },
  {
    title: "Aujourd'hui : le réseau de test, gratuit",
    paragraphs: [
      "Huntited fonctionne pour l'instant sur le réseau de test de Kaspa (Testnet 10). Les KAS de test sont gratuits et n'ont aucune valeur : tu peux tout essayer sans risque.",
    ],
    steps: [
      "Installe le wallet Kastle, une extension pour ton navigateur.",
      "Crée un compte réservé à Huntited (par exemple « Huntited ») et note ta phrase de récupération sur papier.",
      "Dans les réglages de Kastle, passe sur le réseau « Testnet 10 ».",
      "Copie l'adresse de ce compte et demande des KAS de test sur le faucet du réseau de test.",
      "Reviens sur Huntited et clique « Connecter le wallet ».",
    ],
    links: [
      { label: "Kastle (wallet)", href: "https://kastle.cc/" },
      { label: "Faucet du réseau de test", href: "https://faucet-tn10.kaspanet.io/" },
    ],
  },
  {
    title: "Plus tard : de vrais KAS",
    paragraphs: [
      "Quand Huntited passera sur le réseau principal, il faudra de vrais KAS. Trois façons courantes d'en obtenir : une plateforme d'échange (qui demande en général une pièce d'identité), un achat de personne à personne, ou un envoi d'un proche qui en a déjà.",
      "Le prix du KAS varie beaucoup. Huntited ne donne aucun conseil d'investissement : procure-toi seulement ce dont tu as besoin pour tes engagements.",
      "Membre d'un syndicat, d'une association ou d'un collectif ? Avec le pass d'organisation, elle t'ouvre ses actions : tu t'engages sans wallet ni KAS.",
    ],
  },
  {
    title: "Ce que ça coûte",
    paragraphs: [
      "S'engager : 0,2 KAS pour inscrire l'engagement sur la blockchain (non rendus), plus un dépôt de 5 KAS rendu à la fin. Créer une action : 0,2 KAS d'inscription et une caution, dont une partie paie les participants et Huntited.",
      "Pour l'instant, le dépôt et la caution sont simulés : seuls les 0,2 KAS de test sont réellement envoyés.",
    ],
  },
  {
    title: "Les bons réflexes",
    paragraphs: [
      "Ta phrase de récupération est la clé de ton wallet : garde-la hors ligne, ne la tape jamais sur un site, ne la donne à personne. Huntited ne te la demandera jamais.",
      "Tes engagements sont publics sur la blockchain, avec l'adresse de ton wallet. Pour rester discret, utilise un compte réservé à Huntited, alimenté directement de l'extérieur plutôt que depuis ton compte principal.",
      "Avant d'envoyer, vérifie dans Kastle le montant et la destination : c'est l'adresse du registre Huntited, pour 0,2 KAS.",
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
      "Install the Kastle wallet, a browser extension.",
      "Create an account just for Huntited (for example “Huntited”) and write your recovery phrase down on paper.",
      "In Kastle's settings, switch to the “Testnet 10” network.",
      "Copy this account's address and request test KAS from the test network faucet.",
      "Come back to Huntited and click “Connect wallet”.",
    ],
    links: [
      { label: "Kastle (wallet)", href: "https://kastle.cc/" },
      { label: "Test network faucet", href: "https://faucet-tn10.kaspanet.io/" },
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
      "Committing: 0.2 KAS to write the commitment on the blockchain (not returned), plus a 5 KAS deposit returned at the end. Creating an action: 0.2 KAS to register it and a deposit, part of which pays participants and Huntited.",
      "For now, deposits are simulated: only the 0.2 test KAS are actually sent.",
    ],
  },
  {
    title: "Good habits",
    paragraphs: [
      "Your recovery phrase is your wallet's key: keep it offline, never type it on a website, never give it to anyone. Huntited will never ask for it.",
      "Your commitments are public on the blockchain, with your wallet address. To stay discreet, use an account just for Huntited, funded directly from outside rather than from your main account.",
      "Before sending, check in Kastle the amount and destination: the Huntited registry address, for 0.2 KAS.",
    ],
  },
];

export const kaspaGuide = (locale: Locale): GuideSection[] => (locale === "fr" ? FR : EN);
