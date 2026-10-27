// Contenu de la page légale (conditions, vie privée, charte), en français et
// en anglais. MODÈLE à faire relire par un·e juriste avant l'ouverture au
// public (voir docs/legal.md). Les valeurs entre crochets sont à compléter
// à la mise en ligne.
import type { Locale } from "./i18n";

export interface LegalSection {
  id: "conditions" | "privacy" | "charter";
  title: string;
  blocks: { heading?: string; paragraphs: string[] }[];
}

export const LEGAL_UPDATED = "2026-10-06";
export const LEGAL_CONTACT = "Huntited@proton.me";

const fr: LegalSection[] = [
  {
    id: "conditions",
    title: "Conditions d'utilisation",
    blocks: [
      {
        heading: "1. Le service",
        paragraphs: [
          "Huntited permet de coordonner des actions collectives : une personne crée une « action » (un objectif, un lieu, une date limite, un nombre minimum de participants), d'autres s'y engagent, et l'action n'est déclenchée que si le seuil est atteint.",
          "Le service est une version de test : il fonctionne sur le réseau de test de Kaspa (testnet-10), sans KAS réels. Les montants affichés sont simulés. Le service peut être interrompu, modifié ou remis à zéro à tout moment.",
        ],
      },
      {
        heading: "2. Accès",
        paragraphs: [
          "L'accès ne demande ni compte, ni e-mail, ni pièce d'identité : un wallet Kaspa suffit pour créer ou s'engager, et un pass Huntited (obtenu par invitation) peut être exigé pour s'engager.",
          "Tu dois avoir l'âge de la majorité dans ton pays, ou l'accord de tes représentants légaux.",
        ],
      },
      {
        heading: "3. Ton engagement",
        paragraphs: [
          "En t'engageant, tu bloques un dépôt (5 KAS) rendu à la fin, et tu acceptes les règles de résolution affichées au moment de l'engagement (récompense du créateur, seuil personnel).",
          "Un engagement peut être retiré tant que l'action ne s'est pas déclenchée ; ensuite, il ne peut plus l'être. Huntited n'a aucun moyen de forcer quiconque à participer à l'action : le déclenchement signifie seulement que le seuil est atteint.",
          "Créer une action ou s'engager l'inscrit sur la blockchain Kaspa : cela coûte 0,2 KAS, non rendus, et c'est public et permanent (voir « Vie privée »).",
          "Si tu crées une action, ta caution n'est pas rendue en entier : une partie récompense les participants si l'action a lieu, et une partie revient à Huntited pour financer le développement et l'hébergement du service. Le détail exact est affiché avant la création.",
        ],
      },
      {
        heading: "4. Responsabilité des créateurs et des participants",
        paragraphs: [
          "Chaque personne reste seule responsable des actions qu'elle propose ou auxquelles elle participe, et du respect des lois de son pays (droit de réunion, déclaration de manifestation, sécurité des personnes…).",
          "Le créateur s'engage à décrire honnêtement l'action, le lieu, la date et les risques connus, conformément à la charte.",
        ],
      },
      {
        heading: "5. Usages interdits",
        paragraphs: [
          "Il est interdit d'utiliser Huntited pour organiser ou encourager des violences, des actes illégaux, du harcèlement, de la discrimination, ou pour exposer, ficher ou piéger des personnes ; ainsi que pour tromper les participants ou contourner les protections (multiplication de wallets, revente de pass).",
          "Signalement : écris à [contact] en indiquant le lien de l'action. Les actions manifestement contraires à ces règles peuvent être masquées sur le site par la clé de huntited.kas (liste publique sur la page « Versions et modération ») ; elles restent inscrites sur la blockchain, que personne ne peut modifier.",
        ],
      },
      {
        heading: "6. Absence de garantie",
        paragraphs: [
          "Le service est fourni « en l'état », sans garantie de disponibilité ni d'adéquation à un usage particulier. Dans les limites permises par la loi, Huntited ne peut être tenu responsable des dommages résultant de l'utilisation du service, des actions organisées par ses utilisateurs, ou d'un dysfonctionnement d'un wallet ou du réseau Kaspa.",
        ],
      },
      {
        heading: "7. Modifications et droit applicable",
        paragraphs: [
          "Ces conditions peuvent évoluer ; la date de mise à jour figure en haut de la page. Elles sont régies par le droit français.",
        ],
      },
    ],
  },
  {
    id: "privacy",
    title: "Vie privée",
    blocks: [
      {
        heading: "Le principe",
        paragraphs: [
          "Huntited est conçu pour collecter le moins possible : pas de compte, pas d'e-mail, pas de nom, pas de traceur publicitaire, pas de cookie de mesure d'audience.",
          "Mais sur huntited.com, les actions et les engagements sont inscrits sur la blockchain Kaspa (réseau de test pour l'instant). Ce qui y est écrit est public et permanent : personne, pas même Huntited, ne peut l'effacer.",
        ],
      },
      {
        heading: "Ce qui est public sur la blockchain",
        paragraphs: [
          "Création d'une action : son contenu (titre, description, lieu, pays, date limite, seuil, caution), l'adresse du wallet du créateur et sa clé publique de chat.",
          "Engagement : l'adresse de ton wallet, l'identifiant de l'action, ton éventuel seuil personnel et ta clé publique de chat.",
          "Le site n'affiche jamais qui s'est engagé, mais quelqu'un qui lit la blockchain peut le voir, et compter les engagements même quand la progression est masquée sur le site. Huntited garde aussi une copie publique de ces transactions (archives du registre). Pour plus de discrétion, utilise un wallet qui n'est pas relié à ton identité.",
          "Les messages du chat ne sont pas sur la blockchain : ils sont chiffrés pour les seuls membres de l'action (voir « Services tiers »).",
        ],
      },
      {
        heading: "Ce qui reste sur ton appareil",
        paragraphs: [
          "Dans le stockage de ton navigateur : ton wallet intégré (sa phrase de récupération, chiffrée si tu l'as protégé par un code ou une empreinte), l'état de connexion de ton wallet, ta langue et ton thème, le brouillon de création, la liste des actions que tu as créées ou rejointes, tes clés et messages de chat, et tes réglages de badges. Ces données ne quittent pas ton appareil ; la page « Tes données » permet de les voir, de les exporter et de les effacer.",
          "La recherche de villes se fait sur ton appareil : aucune lettre tapée n'est envoyée (données GeoNames, CC BY 4.0).",
        ],
      },
      {
        heading: "Services tiers",
        paragraphs: [
          "Sur huntited.com, ton navigateur contacte directement : l'API publique du réseau de test Kaspa (pour lire la blockchain), Codeberg (hébergement du site et de l'archive du registre) et, pour le chat, des relais Nostr publics (relay.damus.io, nos.lol, relay.primal.net). Une copie du site est aussi publiée sur IPFS (Filebase). Ces services voient ton adresse IP et l'heure de tes visites, pas le contenu de tes messages.",
          "Chat : chaque membre a une clé de chat par action, créée et gardée dans son navigateur. Les messages et les pseudos sont chiffrés pour les seuls membres ; les relais voient l'heure d'envoi et la clé publique de l'auteur, inscrite sur la blockchain avec son engagement. Les messages portent une date d'expiration (24 heures après la date limite), que les relais peuvent ne pas respecter.",
          "Ton wallet (par exemple Kastle) et le réseau Kaspa ont leurs propres règles. Le bouton « Répondre à un tweet » ouvre X (x.com) : ce que tu y publies relève des conditions de X. Huntited n'envoie aucune donnée à ces services.",
        ],
      },
      {
        heading: "Tes droits",
        paragraphs: [
          "Ce qui est inscrit sur la blockchain, et ses copies dans les archives publiques du registre, ne peut être ni corrigé ni effacé : c'est le principe d'une blockchain. Réfléchis avant de créer une action ou de t'engager.",
          "Conformément au RGPD, tu peux demander l'accès, la rectification ou l'effacement des données te concernant en écrivant à [contact]. Comme Huntited ne connaît ni ton nom ni ton adresse de wallet en clair, il faudra fournir l'élément permettant de retrouver la donnée (par exemple le lien de l'action créée). Tu peux aussi saisir la CNIL.",
          "Responsable du traitement : [éditeur], [contact]. Hébergement : [hébergeur, à compléter à la mise en ligne].",
        ],
      },
    ],
  },
  {
    id: "charter",
    title: "Charte",
    blocks: [
      {
        paragraphs: [
          "Huntited facilite la coordination collective sans administrateur du protocole. Cette autonomie implique une responsabilité claire pour les créateurs et les engagés.",
        ],
      },
      {
        heading: "Principes",
        paragraphs: [
          "Respecter les personnes, leur sécurité et leur vie privée.",
          "Présenter honnêtement l'objectif, le lieu, l'échéance et les risques d'une action.",
          "Ne pas chercher à tromper, harceler, discriminer ou exposer des participants.",
          "Ne jamais publier une identité, une adresse ou une preuve permettant de relier une personne à un engagement.",
          "Signaler un abus par les canaux prévus plutôt que de se faire justice.",
        ],
      },
      {
        heading: "Pas de contestation dans le protocole",
        paragraphs: [
          "Pour garder le protocole simple et lisible, cette version ne comporte pas de mécanisme de contestation : la protection contre les abus repose sur cette charte, la réputation des créateurs et le signalement. Un veto des engagés pourra être étudié plus tard.",
        ],
      },
    ],
  },
];

const en: LegalSection[] = [
  {
    id: "conditions",
    title: "Terms of use",
    blocks: [
      {
        heading: "1. The service",
        paragraphs: [
          'Huntited lets people coordinate collective actions: someone creates an "action" (a goal, a place, a deadline, a minimum number of participants), others commit to it, and the action only triggers if the threshold is reached.',
          "The service is a test version: it runs on the Kaspa test network (testnet-10), with no real KAS. Amounts shown are simulated. The service may be interrupted, changed or reset at any time.",
        ],
      },
      {
        heading: "2. Access",
        paragraphs: [
          "No account, e-mail or ID is required: a Kaspa wallet is enough to create or commit, and a Huntited pass (obtained by invitation) may be required to commit.",
          "You must be of legal age in your country, or have your legal guardians' consent.",
        ],
      },
      {
        heading: "3. Your commitment",
        paragraphs: [
          "By committing, you lock a deposit (5 KAS) that is returned at the end, and you accept the settlement rules shown when you commit (creator's reward, personal threshold).",
          "A commitment can be withdrawn until the action triggers; after that, it can't. Huntited has no way to force anyone to take part in the action: triggering only means the threshold was reached.",
          "Creating an action or committing writes it on the Kaspa blockchain: it costs 0.2 KAS, not returned, and it's public and permanent (see “Privacy”).",
          "If you create an action, your deposit isn't fully returned: part of it rewards participants if the action happens, and part goes to Huntited to fund the development and hosting of the service. The exact breakdown is shown before you create it.",
        ],
      },
      {
        heading: "4. Responsibility of creators and participants",
        paragraphs: [
          "Everyone is solely responsible for the actions they propose or join, and for complying with the laws of their country (right of assembly, notice of demonstrations, people's safety…).",
          "Creators commit to describing the action, place, date and known risks honestly, in line with the charter.",
        ],
      },
      {
        heading: "5. Prohibited uses",
        paragraphs: [
          "Huntited must not be used to organise or encourage violence, illegal acts, harassment or discrimination, or to expose, profile or entrap people; nor to deceive participants or bypass protections (multiple wallets, reselling passes).",
          "Reporting: write to [contact] with the action's link. Actions clearly breaching these rules can be hidden on the site by the huntited.kas key (public list on the “Versions and moderation” page); they remain written on the blockchain, which nobody can change.",
        ],
      },
      {
        heading: "6. No warranty",
        paragraphs: [
          'The service is provided "as is", with no guarantee of availability or fitness for a particular purpose. To the extent permitted by law, Huntited can\'t be held liable for damage resulting from using the service, from actions organised by its users, or from a wallet or Kaspa network malfunction.',
        ],
      },
      {
        heading: "7. Changes and governing law",
        paragraphs: [
          "These terms may change; the update date is shown at the top of the page. They are governed by French law.",
        ],
      },
    ],
  },
  {
    id: "privacy",
    title: "Privacy",
    blocks: [
      {
        heading: "The principle",
        paragraphs: [
          "Huntited is designed to collect as little as possible: no account, no e-mail, no name, no ad tracker, no analytics cookie.",
          "But on huntited.com, actions and commitments are written on the Kaspa blockchain (test network for now). What is written there is public and permanent: nobody, not even Huntited, can erase it.",
        ],
      },
      {
        heading: "What is public on the blockchain",
        paragraphs: [
          "Creating an action: its content (title, description, place, country, deadline, threshold, deposit), the creator's wallet address and their public chat key.",
          "Committing: your wallet address, the action's identifier, any personal threshold and your public chat key.",
          "The site never shows who committed, but someone reading the blockchain can see it, and count commitments even when progress is hidden on the site. Huntited also keeps a public copy of these transactions (registry archives). For more discretion, use a wallet that isn't linked to your identity.",
          "Chat messages are not on the blockchain: they are encrypted for the action's members only (see “Third-party services”).",
        ],
      },
      {
        heading: "What stays on your device",
        paragraphs: [
          "In your browser's storage: your built-in wallet (its recovery phrase, encrypted if you protected it with a code or fingerprint), your wallet connection state, your language and theme, the creation draft, the actions you created or joined, your chat keys and messages, and your badge settings. This data doesn't leave your device; the “Your data” page lets you view, export and erase it.",
          "City search runs on your device: no keystroke is sent anywhere (GeoNames data, CC BY 4.0).",
        ],
      },
      {
        heading: "Third-party services",
        paragraphs: [
          "On huntited.com, your browser directly contacts: the public Kaspa test network API (to read the blockchain), Codeberg (hosting of the site and of the registry archive) and, for the chat, public Nostr relays (relay.damus.io, nos.lol, relay.primal.net). A copy of the site is also published on IPFS (Filebase). These services see your IP address and when you visit, not the content of your messages.",
          "Chat: each member has one chat key per action, created and kept in their browser. Messages and nicknames are encrypted for members only; relays see the sending time and the author's public key, which is written on the blockchain with their commitment. Messages carry an expiry date (24 hours after the deadline), which relays may not honour.",
          'Your wallet (for example Kastle) and the Kaspa network have their own rules. The "Reply to a tweet" button opens X (x.com): what you post there falls under X\'s terms. Huntited sends no data to these services.',
        ],
      },
      {
        heading: "Your rights",
        paragraphs: [
          "What is written on the blockchain, and its copies in the public registry archives, can be neither corrected nor erased: that's how a blockchain works. Think before creating an action or committing.",
          "Under the GDPR, you can request access to, correction or erasure of data about you by writing to [contact]. Since Huntited knows neither your name nor your wallet address in clear, you'll need to provide something that lets us find the data (for example the link of the action you created). You can also contact the CNIL (French data protection authority).",
          "Data controller: [publisher], [contact]. Hosting: [host, to be completed at launch].",
        ],
      },
    ],
  },
  {
    id: "charter",
    title: "Charter",
    blocks: [
      {
        paragraphs: [
          "Huntited makes collective coordination possible without a protocol administrator. This autonomy comes with clear responsibility for creators and participants.",
        ],
      },
      {
        heading: "Principles",
        paragraphs: [
          "Respect people, their safety and their privacy.",
          "Present an action's goal, place, deadline and risks honestly.",
          "Never try to deceive, harass, discriminate against or expose participants.",
          "Never publish an identity, an address or any evidence linking a person to a commitment.",
          "Report abuse through the provided channels rather than taking matters into your own hands.",
        ],
      },
      {
        heading: "No dispute mechanism in the protocol",
        paragraphs: [
          "To keep the protocol simple and readable, this version has no dispute mechanism: protection against abuse relies on this charter, creators' reputation and reporting. A participant veto may be considered later.",
        ],
      },
    ],
  },
];

/** Sections dans la langue demandée, avec le contact renseigné. */
export function legalSections(locale: Locale): LegalSection[] {
  const fill = (s: string) => s.replaceAll("[contact]", LEGAL_CONTACT);
  return (locale === "fr" ? fr : en).map((section) => ({
    ...section,
    blocks: section.blocks.map((b) => ({
      ...(b.heading ? { heading: b.heading } : {}),
      paragraphs: b.paragraphs.map(fill),
    })),
  }));
}
