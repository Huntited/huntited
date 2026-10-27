// Conditions d'engagement de Huntited, en français et en anglais.
// Texte volontairement court et lisible : un utilisateur non crypto doit
// comprendre l'essentiel sans jargon.
//
// Les montants dépendent de la caution de chaque chasse (30 KAS au moins) :
// chaque texte est une fonction de la caution, calculée par hunt-economics.ts
// (vérifié dans les tests). Les constantes en MAJUSCULES valent pour la
// caution minimale de 30 KAS, en français.
import {
  CREATE_DEPOSIT_SOMPI,
  SOMPI_PER_KAS,
  cautionTerms,
  sompiToKasFr,
  sompiToKasText,
} from "./hunt-economics";
import type { Locale } from "./i18n";

const amounts = (cautionKas: number, locale: Locale) => {
  const kas = (sompi: bigint) =>
    `${locale === "fr" ? sompiToKasFr(sompi) : sompiToKasText(roundCents(sompi))} KAS`;
  const caution = BigInt(cautionKas) * SOMPI_PER_KAS;
  const c = cautionTerms(caution);
  return {
    caution: kas(caution),
    cap: kas(c.capPerCommitSompi),
    pool: kas(c.successPoolSompi),
    successTreasury: kas(c.successTreasurySompi),
    failureTreasury: kas(c.failureTreasurySompi),
    failureRefund: kas(caution - c.failureTreasurySompi),
  };
};
const roundCents = (s: bigint) => ((s + 500_000n) / 1_000_000n) * 1_000_000n;
const MIN = Number(CREATE_DEPOSIT_SOMPI / SOMPI_PER_KAS);

/** Dépôt d'engagement et récompense (ce que l'engagé·e reçoit). */
export const commitDepositTerms = (cautionKas: number, locale: Locale = "fr") => {
  const { cap } = amounts(cautionKas, locale);
  return locale === "fr"
    ? `Tes 5 KAS sont bloqués puis rendus à la fin, que l'action ait lieu ou non. Si elle a lieu, tu reçois en plus une récompense du créateur, jusqu'à ${cap}.`
    : `Your 5 KAS are locked, then returned at the end, whether the action happens or not. If it happens, you also receive a reward from the creator, up to ${cap}.`;
};

/** Caution du créateur : ce qu'elle devient (il n'y gagne jamais rien). */
export const createDepositTerms = (cautionKas: number, locale: Locale = "fr") => {
  const a = amounts(cautionKas, locale);
  return locale === "fr"
    ? `Le créateur bloque une caution de ${a.caution}. Action réussie : jusqu'à ${a.cap} par engagé (${a.pool} au plus), ${a.successTreasury} à Huntited, le reste lui est rendu. Action annulée : ${a.failureTreasury} à Huntited, ${a.failureRefund} lui sont rendus.`
    : `The creator locks a deposit of ${a.caution}. Action happens: up to ${a.cap} per participant (${a.pool} at most), ${a.successTreasury} to Huntited, the rest is returned to them. Action cancelled: ${a.failureTreasury} to Huntited, ${a.failureRefund} returned to them.`;
};

/**
 * Argument mis en avant au moment de s'engager : on récupère toujours son
 * dépôt, plus une récompense si l'action a lieu. Ne pas écrire « gratuit » :
 * des frais de réseau existeront avec de vrais KAS.
 */
export const commitRefundHighlight = (cautionKas: number, locale: Locale = "fr") => {
  const { cap } = amounts(cautionKas, locale);
  return locale === "fr"
    ? `Tes 5 KAS de dépôt te sont rendus intégralement à la fin. Et si l'action a lieu, tu reçois une récompense du créateur, jusqu'à ${cap}.`
    : `Your 5 KAS deposit is returned in full at the end. And if the action happens, you receive a reward from the creator, up to ${cap}.`;
};

/** Version courte, sous le bouton d'engagement. */
export const commitRefundShort = (cautionKas: number, locale: Locale = "fr") => {
  const { cap } = amounts(cautionKas, locale);
  return locale === "fr"
    ? `Rendus intégralement à la fin + jusqu'à ${cap} de récompense si l'action a lieu.`
    : `Returned in full at the end + up to ${cap} reward if the action happens.`;
};

export const COMMIT_DEPOSIT_TERMS = commitDepositTerms(MIN);
export const CREATE_DEPOSIT_TERMS = createDepositTerms(MIN);
export const COMMIT_REFUND_HIGHLIGHT = commitRefundHighlight(MIN);
export const COMMIT_REFUND_SHORT = commitRefundShort(MIN);

/**
 * Conditions clés listées dans la modal d'engagement, sous l'encadré qui
 * affiche déjà les conditions de dépôt (non répétées ici).
 */
export const termsShortFor = (cautionKas: number, locale: Locale = "fr"): string[] =>
  locale === "fr"
    ? [
        createDepositTerms(cautionKas, locale),
        "Tes KAS restent bloqués jusqu'à la fin de l'action.",
        "Tout le monde ou personne : l'action n'a lieu que si le seuil est atteint.",
        "Public : ton engagement est inscrit sur la blockchain avec l'adresse de ton wallet (0,2 KAS d'inscription, non rendus).",
      ]
    : [
        createDepositTerms(cautionKas, locale),
        "Your KAS stay locked until the end of the action.",
        "Everyone or no one: the action only happens if the threshold is reached.",
        "Public: your commitment is written on the blockchain with your wallet address (0.2 KAS to register, not returned).",
      ];
export const termsShort = termsShortFor(MIN);

/**
 * Texte complet des conditions.
 * NOTE : version de travail — le texte long définitif sera fourni
 * ultérieurement (référence pour la page légale à venir).
 */
export const termsFullFor = (cautionKas: number, locale: Locale = "fr") => {
  const a = amounts(cautionKas, locale);
  if (locale === "en") {
    return `
COMMITMENT TERMS — HUNTITED (test version)

1. What you lock
By committing, you lock 5 KAS until the end of the hunt (end of the
action or deadline passed). They are returned in full at the end, in
every case. You can't take them back before.

2. The creator's reward
The creator locks a deposit (${a.caution} for this hunt, 30 KAS at
least). They never gain anything from it: part of it is returned.
- The action happens (threshold reached): up to ${a.pool} are shared
  equally among participants, capped at ${a.cap} each, and
  ${a.successTreasury} go to Huntited. The rest is returned to the creator.
- The action doesn't happen (threshold not reached by the deadline): no
  reward. ${a.failureTreasury} go to Huntited, ${a.failureRefund} are returned
  to the creator.
- What goes to Huntited funds the development and hosting of the
  service.
- You set a personal threshold ("I'll come if at least N people come")
  and it isn't reached while the action happens: you don't take part
  and you get your 5 KAS back, without a reward.
Shares are rounded down to the smallest possible amount (the sompi);
what's left is returned to the creator.

3. Everyone or no one
The action triggers for all participants at the same time, or not at
all. Nobody ends up exposed alone.

4. What is public
Your commitment is written on the Kaspa blockchain with your wallet
address, the hunt's identifier and any personal threshold. It is
public and permanent: anyone can read it, even though the site doesn't
show it. The creator can hide the number of commitments on the site,
but it stays readable on the blockchain. For more discretion, use a
wallet that isn't linked to your identity.
Registering the commitment costs 0.2 KAS, not returned.
`.trim();
  }
  return `
CONDITIONS D'ENGAGEMENT — HUNTITED (version de test)

1. Ce que tu bloques
En t'engageant, tu bloques 5 KAS jusqu'à la fin de la chasse (fin de
l'action ou date limite passée). Ils te sont rendus intégralement à la
fin, dans tous les cas. Tu ne peux pas les reprendre avant.

2. La récompense du créateur
Le créateur bloque une caution (${a.caution} pour cette chasse, 30 KAS au
moins). Il n'y gagne jamais rien : on lui en rend une partie.
- L'action a lieu (seuil atteint) : jusqu'à ${a.pool} sont partagés à
  parts égales entre les engagés, plafonnés à ${a.cap} chacun, et
  ${a.successTreasury} vont à Huntited. Le reste est rendu au créateur.
- L'action n'a pas lieu (seuil pas atteint à la date limite) : pas de
  récompense. ${a.failureTreasury} vont à Huntited, ${a.failureRefund} sont rendus
  au créateur.
- Ce qui va à Huntited finance le développement et l'hébergement du
  service.
- Tu as fixé un seuil personnel (« je viens si au moins N personnes
  viennent ») et il n'est pas atteint alors que l'action a lieu : tu
  ne participes pas et tu récupères tes 5 KAS, sans part de la
  récompense.
Les parts sont arrondies au plus petit montant possible (le sompi) ;
ce qui reste est rendu au créateur.

3. Tout le monde ou personne
L'action se déclenche pour tous les participants en même temps, ou
pas du tout. Personne ne se retrouve exposé seul.

4. Ce qui est public
Ton engagement est inscrit sur la blockchain Kaspa avec l'adresse de
ton wallet, l'identifiant de la chasse et ton éventuel seuil
personnel. C'est public et permanent : n'importe qui peut le lire,
même si le site ne l'affiche pas. Le créateur peut masquer le nombre
d'engagés sur le site, mais il reste lisible sur la blockchain. Pour
plus de discrétion, utilise un wallet qui n'est pas relié à ton
identité.
Inscrire l'engagement coûte 0,2 KAS, non rendus.
`.trim();
};
export const termsFull = termsFullFor(MIN);
