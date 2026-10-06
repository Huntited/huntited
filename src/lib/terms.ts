// Conditions d'engagement de Huntited.
// Texte volontairement court et lisible : un utilisateur non crypto doit
// comprendre l'essentiel sans jargon.

/**
 * Formulations de référence des dépôts (MVP). Tout écran qui explique les
 * dépôts réutilise ces constantes pour éviter les divergences de texte.
 * Les montants sont vérifiés contre hunt-economics.ts dans les tests.
 */
export const COMMIT_DEPOSIT_TERMS =
  "S'engager coûte 5 KAS. Si l'action a lieu, tes 5 KAS vont au créateur (95 %) et à Huntited (5 %), et tu reçois ta part des 28,5 KAS de la caution du créateur. Si elle n'a pas lieu (pas assez de monde à la date limite), tu récupères tes 5 KAS, plus ta part des 14,25 KAS de la caution.";

export const CREATE_DEPOSIT_TERMS =
  "Le créateur bloque une caution de 30 KAS, partagée avec les engagés. Si l'action a lieu, 95 % de la caution (28,5 KAS) est partagée entre les engagés et 5 % va à Huntited. Sinon, 47,5 % (14,25 KAS) est partagée entre les engagés, 2,5 % va à Huntited et le créateur récupère la moitié.";

/**
 * Argument mis en avant au moment de s'engager : l'échec rapporte même une
 * part de la caution. Ne pas écrire « gratuit » : en cas de succès,
 * l'engagement coûte 5 KAS.
 */
export const COMMIT_REFUND_HIGHLIGHT =
  "Tu ne perds rien si ça ne se fait pas : tes 5 KAS te sont rendus intégralement, plus ta part des 14,25 KAS de la caution du créateur. Et si ça se fait, tu reçois ta part des 28,5 KAS.";

/** Version courte, sous le bouton d'engagement. */
export const COMMIT_REFUND_SHORT =
  "Si ça ne se fait pas : remboursé intégralement + une part de la caution du créateur.";

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
  le créateur et 5 % pour Huntited. En échange, 95 % de la caution de
  30 KAS du créateur (28,5 KAS) est partagée à parts égales entre les
  engagés ; les 5 % restants vont à Huntited.
- L'action n'a pas lieu (seuil pas atteint à la date limite) : tu
  récupères tes 5 KAS. 47,5 % de la caution (14,25 KAS) est partagée à
  parts égales entre les engagés, 2,5 % va à Huntited et le créateur
  récupère la moitié (15 KAS).
- Tu as fixé un seuil personnel (« je viens si au moins N personnes
  viennent ») et il n'est pas atteint alors que l'action a lieu : tu
  ne participes pas et tu récupères tes 5 KAS, sans part de la caution.
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
