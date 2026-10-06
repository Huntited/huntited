// Conditions d'engagement de Huntited.
// Texte volontairement court et lisible : un utilisateur non crypto doit
// comprendre l'essentiel sans jargon.
//
// Les montants dépendent de la caution de chaque chasse (30 KAS au moins) :
// chaque texte est une fonction de la caution, calculée par hunt-economics.ts
// (vérifié dans les tests). Les constantes en MAJUSCULES valent pour la
// caution minimale de 30 KAS.
import { CREATE_DEPOSIT_SOMPI, SOMPI_PER_KAS, cautionTerms, sompiToKasFr } from "./hunt-economics";

const kas = (sompi: bigint) => `${sompiToKasFr(sompi)} KAS`;
const amounts = (cautionKas: number) => {
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
const MIN = Number(CREATE_DEPOSIT_SOMPI / SOMPI_PER_KAS);

/** Dépôt d'engagement et récompense (ce que l'engagé·e reçoit). */
export const commitDepositTerms = (cautionKas: number) =>
  `Tes 5 KAS sont bloqués puis rendus à la fin, que l'action ait lieu ou non. Si elle a lieu, tu reçois en plus une récompense du créateur, jusqu'à ${amounts(cautionKas).cap}.`;

/** Caution du créateur : ce qu'elle devient (il n'y gagne jamais rien). */
export const createDepositTerms = (cautionKas: number) => {
  const a = amounts(cautionKas);
  return `Le créateur bloque une caution de ${a.caution}. Action réussie : jusqu'à ${a.cap} par engagé (${a.pool} au plus), ${a.successTreasury} à Huntited, le reste lui est rendu. Action annulée : ${a.failureTreasury} à Huntited, ${a.failureRefund} lui sont rendus.`;
};

/**
 * Argument mis en avant au moment de s'engager : on récupère toujours son
 * dépôt, plus une récompense si l'action a lieu. Ne pas écrire « gratuit » :
 * des frais de réseau existeront avec de vrais KAS.
 */
export const commitRefundHighlight = (cautionKas: number) =>
  `Tu ne perds rien : tes 5 KAS te sont rendus intégralement à la fin. Et si l'action a lieu, tu reçois une récompense du créateur, jusqu'à ${amounts(cautionKas).cap}.`;

/** Version courte, sous le bouton d'engagement. */
export const commitRefundShort = (cautionKas: number) =>
  `Rendus intégralement à la fin + jusqu'à ${amounts(cautionKas).cap} de récompense si l'action a lieu.`;

export const COMMIT_DEPOSIT_TERMS = commitDepositTerms(MIN);
export const CREATE_DEPOSIT_TERMS = createDepositTerms(MIN);
export const COMMIT_REFUND_HIGHLIGHT = commitRefundHighlight(MIN);
export const COMMIT_REFUND_SHORT = commitRefundShort(MIN);

/**
 * Conditions clés listées dans la modal d'engagement, sous l'encadré qui
 * affiche déjà les conditions de dépôt (non répétées ici).
 */
export const termsShortFor = (cautionKas: number): string[] => [
  createDepositTerms(cautionKas),
  "Tes KAS restent bloqués jusqu'à la fin de la chasse.",
  "Tout le monde ou personne : l'action n'a lieu que si le seuil est atteint.",
  "Anonyme : ton engagement n'est jamais enregistré sous ton adresse.",
];
export const termsShort = termsShortFor(MIN);

/**
 * Texte complet des conditions.
 * NOTE : version de travail — le texte long définitif sera fourni
 * ultérieurement (référence pour la page légale à venir).
 */
export const termsFullFor = (cautionKas: number) => {
  const a = amounts(cautionKas);
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
- Tu as fixé un seuil personnel (« je viens si au moins N personnes
  viennent ») et il n'est pas atteint alors que l'action a lieu : tu
  ne participes pas et tu récupères tes 5 KAS, sans part de la
  récompense.
Les parts sont arrondies au plus petit montant possible (le sompi) ;
ce qui reste est rendu au créateur.

3. Tout le monde ou personne
L'action se déclenche pour tous les participants en même temps, ou
pas du tout. Personne ne se retrouve exposé seul.

4. Anonymat
Ton engagement est enregistré sous une empreinte anonyme, jamais sous
ton adresse. Le créateur choisit si le nombre d'engagés est visible
de tous ou caché jusqu'au déclenchement ou à la date limite. Dans
cette version, c'est seulement caché à l'écran :
ce n'est pas encore une garantie cryptographique.

`.trim();
};
export const termsFull = termsFullFor(MIN);
