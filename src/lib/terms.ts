// Conditions d'engagement de Huntited.
// Texte volontairement court et lisible : un utilisateur non crypto doit
// comprendre l'essentiel sans jargon.

/**
 * Formulations de référence des dépôts (MVP). Tout écran qui explique les
 * dépôts réutilise ces constantes pour éviter les divergences de texte.
 * Les montants sont vérifiés contre hunt-economics.ts dans les tests.
 */
export const COMMIT_DEPOSIT_TERMS =
  "Un engagement coûte 5 KAS. Si le seuil n'est pas atteint avant la deadline, le dépôt est remboursé intégralement. Si le seuil est atteint, le dépôt finance le créateur à 95 % et la treasury à 5 %.";

export const CREATE_DEPOSIT_TERMS =
  "Le dépôt de création de 30 KAS est remboursé au créateur dans les deux scénarios MVP.";

/**
 * Conditions clés listées dans la modal d'engagement, sous l'encadré qui
 * affiche déjà COMMIT_DEPOSIT_TERMS (non répété ici).
 */
export const termsShort: string[] = [
  CREATE_DEPOSIT_TERMS,
  "Pas de remboursement à la demande : une fois engagé, ton dépôt est verrouillé.",
  "Déclenchement atomique : soit la chasse atteint son seuil et s'active, soit elle expire.",
  "Confidentialité : tes engagements sont protégés (ZK / commitments).",
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
- si la chasse échoue, le créateur récupère ses 30 KAS et chaque
  engagé récupère ses 5 KAS ; la treasury ne reçoit rien.

3. Déclenchement atomique
Le déclenchement est atomique : soit le seuil est atteint et l'action
s'active pour tous les participants en même temps, soit elle expire.
Il n'existe pas d'état intermédiaire où une partie des participants
serait exposée sans les autres.

4. Confidentialité des engagements
Le nombre de participants engagés reste caché jusqu'au déclenchement
(preuves ZK / commitments Merkle). Personne — pas même les opérateurs
du service — ne peut savoir combien de personnes sont engagées avant
ce moment.

`.trim();
