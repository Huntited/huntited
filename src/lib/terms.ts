// Conditions d'engagement de Huntited.
// Texte volontairement court et lisible : un utilisateur non crypto doit
// comprendre l'essentiel sans jargon.

/**
 * Formulations de référence des dépôts (MVP). Tout écran qui explique les
 * dépôts réutilise ces constantes pour éviter les divergences de texte.
 * Les montants sont vérifiés contre hunt-economics.ts dans les tests.
 */
export const COMMIT_DEPOSIT_TERMS =
  "Un engagement coûte 5 KAS. Si le seuil n'est pas atteint avant la deadline, le dépôt est remboursé intégralement, avec un bonus pouvant aller jusqu'à 1 KAS pris sur le dépôt du créateur. Si le seuil est atteint, le dépôt finance le créateur à 95 % et la treasury à 5 %.";

export const CREATE_DEPOSIT_TERMS =
  "Le dépôt de création de 30 KAS est remboursé au créateur si le seuil est atteint. Sinon, il verse d'abord 1 KAS de bonus à chaque engagé (30 KAS au plus, partagés au-delà de 30 engagés) et le créateur récupère le reste.";

/**
 * Argument mis en avant au moment de s'engager : l'échec rapporte même un
 * bonus. Ne pas écrire « gratuit » : en cas de succès, l'engagement coûte 5 KAS.
 */
export const COMMIT_REFUND_HIGHLIGHT =
  "Gagnant même si ça ne se fait pas : si le seuil n'est pas atteint, tes 5 KAS te sont rendus intégralement, avec un bonus pouvant aller jusqu'à 1 KAS.";

/** Version courte, sous le bouton d'engagement. */
export const COMMIT_REFUND_SHORT =
  "Si le seuil n'est pas atteint : remboursé intégralement + jusqu'à 1 KAS de bonus.";

/**
 * Conditions clés listées dans la modal d'engagement, sous l'encadré qui
 * affiche déjà COMMIT_DEPOSIT_TERMS (non répété ici).
 */
export const termsShort: string[] = [
  CREATE_DEPOSIT_TERMS,
  "Pas de remboursement à la demande : une fois engagé, ton dépôt est verrouillé.",
  "Déclenchement atomique : soit la chasse atteint son seuil et s'active, soit elle expire.",
  "Confidentialité : ton engagement est enregistré sous une empreinte anonyme, jamais sous ton adresse.",
];

/**
 * Texte complet des conditions.
 * NOTE : version de travail — le texte long définitif sera fourni
 * ultérieurement (référence pour la page légale à venir).
 */
export const termsFull = `
CONDITIONS D'ENGAGEMENT — HUNTITED (MVP)

1. Dépôt et engagement
En confirmant, tu engages un dépôt de 5 KAS. Ce dépôt est verrouillé
dans le covenant de la chasse jusqu'au déclenchement ou à l'expiration
de l'action. Il ne peut pas être retiré sur simple demande.

2. Pas de remboursement à la demande
Une fois engagé, ton dépôt ne peut plus être récupéré sur simple
demande. Il n'est libéré que selon les règles du protocole :
- si la chasse réussit, le créateur récupère ses 30 KAS et le total
  des dépôts d'engagement est réparti 95 % au créateur, 5 % à la
  treasury Huntited ; les engagés ne récupèrent pas leur dépôt ;
- si la chasse échoue, chaque engagé récupère ses 5 KAS plus un
  bonus de 1 KAS pris sur le dépôt de création du créateur (bonus total
  plafonné à 30 KAS, partagé à parts égales au-delà de 30 engagés) ;
  le créateur récupère le reste de ses 30 KAS ; la treasury ne reçoit rien ;
- si tu as fixé un seuil personnel (« je viens si au moins N personnes
  viennent ») et qu'il n'est pas atteint alors que la chasse réussit, tu
  ne participes pas : tu récupères tes 5 KAS, sans bonus.

3. Déclenchement atomique
Le déclenchement est atomique : soit le seuil est atteint et l'action
s'active pour tous les participants en même temps, soit elle expire.
Il n'existe pas d'état intermédiaire où une partie des participants
serait exposée sans les autres.

4. Confidentialité des engagements
Ton engagement est enregistré sous une empreinte anonyme, jamais sous
ton adresse. Selon le choix du créateur, le nombre d'engagés est
visible de tous ou masqué jusqu'à l'activation ou la date limite.
Dans cette version, ce masquage est un simple masquage d'affichage :
ce n'est pas encore une garantie cryptographique (preuves ZK prévues
plus tard).

`.trim();
