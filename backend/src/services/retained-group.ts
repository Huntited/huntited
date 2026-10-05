// Seuil personnel : calcul du « groupe retenu » (voir docs/seuil-personnel.md).
//
// Chaque engagé·e exige au moins `t` personnes (t ≥ seuil de la chasse T).
// Le groupe retenu est le plus grand groupe où la condition de chacun est
// remplie : { engagés avec t ≤ k* }, k* étant le plus grand k tel qu'au moins
// k engagés ont un seuil ≤ k. Ajouter un engagement ne peut que l'agrandir :
// une activation n'est jamais remise en cause.
//
// ⚠️ Copie conforme de src/lib/retained-group.ts (front, mêmes tests).

export interface RetainedGroup {
  /** k* : seuil personnel maximal satisfait ; null s'il n'y a pas de groupe. */
  retainedThreshold: number | null;
  /** Nombre d'engagés retenus (0 sans groupe). */
  retainedCount: number;
}

export function computeRetainedGroup(
  personalThresholds: readonly number[],
  huntThreshold: number,
): RetainedGroup {
  const sorted = [...personalThresholds].sort((a, b) => a - b);
  // Nombre de seuils ≤ k, pour un k décroissant (pointeur sur le tableau trié).
  let count = sorted.length;
  for (let k = sorted.length; k >= huntThreshold; k -= 1) {
    while (count > 0 && sorted[count - 1]! > k) count -= 1;
    if (count >= k) return { retainedThreshold: k, retainedCount: count };
  }
  return { retainedThreshold: null, retainedCount: 0 };
}

/** true si l'engagé·e au seuil personnel `t` fait partie du groupe retenu. */
export function isRetained(t: number, group: RetainedGroup): boolean {
  return group.retainedThreshold !== null && t <= group.retainedThreshold;
}
