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
          "Huntited permet de coordonner des actions collectives : une personne crée une « chasse » (une action, un lieu, une date limite, un nombre minimum de participants), d'autres s'y engagent, et l'action n'est déclenchée que si le seuil est atteint.",
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
          "Un engagement ne peut pas être retiré avant la fin de la chasse. Huntited n'a aucun moyen de forcer quiconque à participer à l'action : le déclenchement signifie seulement que le seuil est atteint.",
          "Si tu crées une chasse, ta caution n'est pas rendue en entier : une partie récompense les participants si l'action a lieu, et une partie revient à Huntited pour financer le développement et l'hébergement du service. Le détail exact est affiché avant la création.",
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
          "Signalement : écris à [contact] en indiquant le lien de la chasse. Les chasses manifestement contraires à ces règles peuvent être retirées de l'affichage.",
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
        ],
      },
      {
        heading: "Ce qui reste sur ton appareil",
        paragraphs: [
          "Dans le stockage de ton navigateur : l'état de connexion de ton wallet, ta langue et ton thème, le brouillon de création, la liste des chasses que tu as créées, rejointes ou suivies, tes réglages de badges, et le secret de ton pass. Ces données ne quittent pas ton appareil ; la page « Tes données » permet de les voir, de les exporter et de les effacer.",
          "La recherche de villes se fait sur ton appareil : aucune lettre tapée n'est envoyée (données GeoNames, CC BY 4.0).",
        ],
      },
      {
        heading: "Ce que conserve le serveur",
        paragraphs: [
          "Les informations publiques des chasses (titre, description, lieu, pays, date limite, seuil, caution), une empreinte du wallet créateur, une empreinte par engagement (propre à chaque chasse) et l'éventuel seuil personnel ; pour les pass, uniquement des empreintes anonymes et des codes à usage unique.",
          "L'adresse de ton wallet n'est jamais conservée en clair. Les adresses IP ne sont pas enregistrées : elles servent seulement, sous forme d'empreinte gardée en mémoire quelques minutes, à limiter les abus.",
          "Chat : les salons sont créés sur un serveur Matrix géré par Huntited, sans fédération, avec chiffrement de bout en bout ; ils sont supprimés, avec les comptes temporaires, 24 heures après la date limite.",
          "Chat des chasses sur la blockchain : sans serveur Huntited. Chaque membre a une clé de chat par chasse, créée et gardée dans son navigateur ; sa partie publique est inscrite sur la blockchain avec la création ou l'engagement. Les messages sont chiffrés pour les seuls membres et transmis par des relais Nostr publics, qui voient l'adresse IP et l'heure d'envoi mais pas le contenu. Ils portent une date d'expiration (24 heures après la date limite), que les relais peuvent ne pas respecter.",
          "Chasse ratée : 24 heures après la date limite, les empreintes d'engagement, seuils personnels et codes de pass de la chasse sont effacés ; seul leur nombre reste affiché.",
          "Notifications (facultatives) : si tu demandes à être prévenu·e, le serveur garde l'adresse de livraison fournie par ton navigateur, l'identifiant de la chasse et ta langue, sans lien avec ton wallet. Elles sont supprimées dès la notification envoyée. Le message, chiffré de bout en bout, transite par le service de notification de ton navigateur (Google, Mozilla, Apple ou Microsoft), qui ne peut pas le lire.",
        ],
      },
      {
        heading: "Services tiers",
        paragraphs: [
          "Ton wallet (par exemple Kastle) et le réseau Kaspa ont leurs propres règles. Le bouton « Répondre à un tweet » ouvre X (x.com) : ce que tu y publies relève des conditions de X. Huntited n'envoie aucune donnée à ces services.",
          "Quand tu connectes Kastle, le serveur Huntited consulte l'historique public de ton adresse sur l'API du réseau de test Kaspa, pour te prévenir si elle a déjà servi hors de Huntited. C'est le serveur qui fait la demande (l'API ne voit pas ton IP), et rien n'est conservé.",
        ],
      },
      {
        heading: "Tes droits",
        paragraphs: [
          "Conformément au RGPD, tu peux demander l'accès, la rectification ou l'effacement des données te concernant en écrivant à [contact]. Comme Huntited ne connaît ni ton nom ni ton adresse de wallet en clair, il faudra fournir l'élément permettant de retrouver la donnée (par exemple le lien de la chasse créée). Tu peux aussi saisir la CNIL.",
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
          "Présenter honnêtement l'objectif, le lieu, l'échéance et les risques d'une chasse.",
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
          'Huntited lets people coordinate collective actions: someone creates a "hunt" (an action, a place, a deadline, a minimum number of participants), others commit to it, and the action only triggers if the threshold is reached.',
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
          "A commitment can't be withdrawn before the end of the hunt. Huntited has no way to force anyone to take part in the action: triggering only means the threshold was reached.",
          "If you create a hunt, your deposit isn't fully returned: part of it rewards participants if the action happens, and part goes to Huntited to fund the development and hosting of the service. The exact breakdown is shown before you create it.",
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
          "Reporting: write to [contact] with the hunt's link. Hunts clearly breaching these rules may be removed from display.",
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
        ],
      },
      {
        heading: "What stays on your device",
        paragraphs: [
          "In your browser's storage: your wallet connection state, your language and theme, the creation draft, the hunts you created, joined or follow, your badge settings, and your pass secret. This data doesn't leave your device; the “Your data” page lets you view, export and erase it.",
          "City search runs on your device: no keystroke is sent anywhere (GeoNames data, CC BY 4.0).",
        ],
      },
      {
        heading: "What the server keeps",
        paragraphs: [
          "Public hunt information (title, description, place, country, deadline, threshold, deposit), a fingerprint of the creator's wallet, one fingerprint per commitment (specific to each hunt) and any personal threshold; for passes, only anonymous fingerprints and single-use codes.",
          "Your wallet address is never stored in clear. IP addresses aren't recorded: they're only used, as a fingerprint kept in memory for a few minutes, to limit abuse.",
          "Chat: rooms are created on a Matrix server run by Huntited, without federation, with end-to-end encryption; they're deleted, along with the temporary accounts, 24 hours after the deadline.",
          "Chat for hunts on the blockchain: no Huntited server. Each member has one chat key per hunt, created and kept in their browser; its public part is written on the blockchain with the hunt or the commitment. Messages are encrypted for members only and carried by public Nostr relays, which see the IP address and sending time but not the content. They carry an expiry date (24 hours after the deadline), which relays may not honour.",
          "Failed hunt: 24 hours after the deadline, the hunt's commitment fingerprints, personal thresholds and pass codes are erased; only their number remains displayed.",
          "Notifications (optional): if you ask to be notified, the server keeps the delivery address provided by your browser, the hunt's identifier and your language, with no link to your wallet. They're deleted as soon as the notification is sent. The message, end-to-end encrypted, goes through your browser's notification service (Google, Mozilla, Apple or Microsoft), which can't read it.",
        ],
      },
      {
        heading: "Third-party services",
        paragraphs: [
          'Your wallet (for example Kastle) and the Kaspa network have their own rules. The "Reply to a tweet" button opens X (x.com): what you post there falls under X\'s terms. Huntited sends no data to these services.',
          "When you connect Kastle, the Huntited server looks up your address's public history on the Kaspa test network API, to warn you if it has been used outside Huntited. The server makes the request (the API doesn't see your IP), and nothing is kept.",
        ],
      },
      {
        heading: "Your rights",
        paragraphs: [
          "Under the GDPR, you can request access to, correction or erasure of data about you by writing to [contact]. Since Huntited knows neither your name nor your wallet address in clear, you'll need to provide something that lets us find the data (for example the link of the hunt you created). You can also contact the CNIL (French data protection authority).",
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
          "Present a hunt's goal, place, deadline and risks honestly.",
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
