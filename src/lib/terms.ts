// Conditions d'engagement de Huntited.
// Texte volontairement court et lisible : un utilisateur non crypto doit
// comprendre l'essentiel sans jargon.

/**
 * Formulations de référence des dépôts (MVP). Tout écran qui explique les
 * dépôts réutilise ces constantes pour éviter les divergences de texte.
 * Les montants sont vérifiés contre hunt-economics.ts dans les tests.
 */
export const COMMIT_DEPOSIT_TERMS =
  "Tes 5 KAS sont bloqués puis rendus à la fin, que l'action ait lieu ou non. Si elle a lieu, tu reçois en plus une récompense du créateur, jusqu'à 1 KAS.";

export const CREATE_DEPOSIT_TERMS =
  "Le créateur bloque une caution de 30 KAS. Action réussie : jusqu'à 1 KAS par engagé (14,25 KAS au plus), 0,75 KAS à Huntited, il récupère le reste. Action annulée : 1 KAS à Huntited, il récupère 29 KAS.";

/**
 * Argument mis en avant au moment de s'engager : on récupère toujours son
 * dépôt, plus une part de la récompense. Ne pas écrire « gratuit » : des
 * frais de réseau existeront avec de vrais KAS.
 */
export const COMMIT_REFUND_HIGHLIGHT =
  "Tu ne perds rien : tes 5 KAS te sont rendus intégralement à la fin. Et si l'action a lieu, tu reçois une récompense du créateur, jusqu'à 1 KAS.";

/** Version courte, sous le bouton d'engagement. */
export const COMMIT_REFUND_SHORT =
  "Rendus intégralement à la fin + jusqu'à 1 KAS de récompense si l'action a lieu.";

/**
 * Conditions clés listées dans la modal d'engagement, sous l'encadré qui
 * affiche déjà COMMIT_DEPOSIT_TERMS (non répété ici).
 */
export const termsShort: string[] = [
  CREATE_DEPOSIT_TERMS,
  "Tes KAS restent bloqués jusqu'à la fin de la chasse.",
  "Tout le monde ou personne : l'action n'a lieu que si le seuil est atteint.",
  "Anonyme : ton engagement n'est jamais enregistré sous ton adresse.",
];

/**
 * Texte complet des conditions.
 * NOTE : version de travail — le texte long définitif sera fourni
 * ultérieurement (référence pour la page légale à venir).
 */
export const termsFull = `
CONDITIONS D'ENGAGEMENT — HUNTITED (version de test)

1. Ce que tu bloques
En t'engageant, tu bloques 5 KAS jusqu'à la fin de la chasse (fin de
l'action ou date limite passée). Ils te sont rendus intégralement à la
fin, dans tous les cas. Tu ne peux pas les reprendre avant.

2. La récompense du créateur
Le créateur bloque une caution de 30 KAS :
- L'action a lieu (seuil atteint) : jusqu'à 14,25 KAS sont partagés à
  parts égales entre les engagés, plafonnés à 1 KAS chacun, et 0,75 KAS
  vont à Huntited. Le créateur récupère le reste.
- L'action n'a pas lieu (seuil pas atteint à la date limite) : pas de
  récompense. 1 KAS va à Huntited, le créateur récupère 29 KAS.
- Tu as fixé un seuil personnel (« je viens si au moins N personnes
  viennent ») et il n'est pas atteint alors que l'action a lieu : tu
  ne participes pas et tu récupères tes 5 KAS, sans part de la
  récompense.
Les parts sont arrondies au plus petit montant possible (le sompi) ;
ce qui reste revient au créateur.

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
