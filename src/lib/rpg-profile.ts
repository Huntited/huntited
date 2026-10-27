// Classe RP choisie sur cet appareil (src/lib/rpg.ts) : envoyée, chiffrée,
// avec les messages du salon, pour que les membres appliquent son bonus.
import { isClassId, type ClassId } from "./rpg";

const STORAGE = "huntited:rpg-class";

export function getMyClass(): ClassId | undefined {
  try {
    const v = localStorage.getItem(STORAGE);
    return isClassId(v) ? v : undefined;
  } catch {
    return undefined;
  }
}

export function setMyClass(cls: ClassId): void {
  try {
    localStorage.setItem(STORAGE, cls);
  } catch {
    /* choix valable pour cette visite */
  }
}
