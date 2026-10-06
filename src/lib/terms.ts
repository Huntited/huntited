// Conditions d'engagement de Huntited.
// Texte volontairement court et lisible : un utilisateur non crypto doit
// comprendre l'essentiel sans jargon.

/**
 * Formulations de référence des dépôts (MVP). Tout écran qui explique les
 * dépôts réutilise ces constantes pour éviter les divergences de texte.
 * Les montants sont vérifiés contre hunt-economics.ts dans les tests.
 */
export const COMMIT_DEPOSIT_TERMS =
  "S'engager coûte 5 KAS. Si l'action n'a pas lieu (pas assez de monde à la date limite), tu récupères tes 5 KAS, plus jusqu'à 1 KAS de bonus. Si elle a lieu, tes 5 KAS sont dépensés : 95 % pour le créateur de la chasse, 5 % pour Huntited.";

export const CREATE_DEPOSIT_TERMS =
  "Le créateur bloque une caution de 30 KAS. Si l'action a lieu, il la récupère. Sinon, elle sert d'abord à donner 1 KAS de bonus à chaque engagé (30 KAS au plus au total, partagés s'il y a plus de 30 engagés), et le créateur récupère le reste.";

/**
 * Argument mis en avant au moment de s'engager : l'échec rapporte même un
 * bonus. Ne pas écrire « gratuit » : en cas de succès, l'engagement coûte 5 KAS.
 */
export const COMMIT_REFUND_HIGHLIGHT =
  "Tu ne perds rien si ça ne se fait pas : tes 5 KAS te sont rendus intégralement, plus jusqu'à 1 KAS de bonus.";

/** Version courte, sous le bouton d'engagement. */
export const COMMIT_REFUND_SHORT =
  "Si ça ne se fait pas : remboursé intégralement + jusqu'à 1 KAS de bonus.";

/**
 * Conditions clés listées dans la modal d'engagement, sous l'encadré qui
 * affiche déjà COMMIT_DEPOSIT_TERMS (non répété ici).
 */
export const termsShort: string[] = [
  CREATE_DEPOSIT_TERMS,
  "Une fois engagé, tu ne peux pas reprendre tes KAS avant la fin de la chasse.",
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
En t'engageant, tu bloques 5 KAS jusqu'à la fin de la chasse (seuil
atteint ou date limite passée). Tu ne peux pas les reprendre avant.

2. Ce qui se passe à la fin
- L'action a lieu (seuil atteint) : tes 5 KAS sont dépensés, 95 % pour
  le créateur et 5 % pour Huntited. Le créateur récupère ses 30 KAS
  de caution.
- L'action n'a pas lieu (seuil pas atteint à la date limite) : tu
  récupères tes 5 KAS, plus un bonus de 1 KAS pris sur la caution du
  créateur (30 KAS de bonus au total au maximum, partagés à parts
  égales s'il y a plus de 30 engagés). Le créateur récupère le reste ;
  Huntited ne prend rien.
- Tu as fixé un seuil personnel (« je viens si au moins N personnes
  viennent ») et il n'est pas atteint alors que l'action a lieu : tu
  ne participes pas et tu récupères tes 5 KAS, sans bonus.

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
