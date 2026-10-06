// Recherche de villes, entièrement sur l'appareil : aucune lettre tapée n'est
// envoyée à un service extérieur (un géocodeur en ligne apprendrait où les
// gens organisent des actions).
//
// Données : GeoNames, villes de plus de 15 000 habitants (licence CC BY 4.0,
// attribution en pied de page). Fichier compact généré par
// scripts/build-cities.mjs : [nom, pays, population, ...noms alternatifs],
// trié par population décroissante. Chargé au premier usage seulement.

export interface CitySuggestion {
  name: string;
  /** Code pays ISO 3166-1 alpha-2. */
  country: string;
  population: number;
  /** Autre nom ayant correspondu à la recherche (ex. « Londres »), s'il diffère. */
  alias?: string;
}

type Row = [string, string, number, ...string[]];

/** Minuscules, sans accents (« Genève » → « geneve »). */
export const normalizeCity = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

interface Indexed {
  row: Row;
  keys: string[];
}

let cache: Promise<Indexed[]> | null = null;

/** Charge (une seule fois) et prépare la liste des villes. */
export function loadCities(url = "/geo/cities.json"): Promise<Indexed[]> {
  cache ??= fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error("cities");
      return r.json() as Promise<Row[]>;
    })
    .then((rows) =>
      rows.map((row) => ({
        row,
        keys: [row[0], ...(row.slice(3) as string[])].map(normalizeCity),
      })),
    )
    .catch((e) => {
      cache = null; // nouvel essai au prochain appel
      throw e;
    });
  return cache;
}

/**
 * Villes dont un nom commence par la saisie (accents et casse ignorés), les
 * plus peuplées d'abord. Au moins 2 caractères.
 */
export function searchCities(
  index: readonly Indexed[],
  query: string,
  limit = 8,
): CitySuggestion[] {
  const q = normalizeCity(query);
  if (q.length < 2) return [];
  const out: CitySuggestion[] = [];
  for (const { row, keys } of index) {
    const i = keys.findIndex((k) => k.startsWith(q));
    if (i < 0) continue;
    const [name, country, population] = row;
    // Nom alternatif affiché seulement s'il correspond exactement à la saisie
    // (« Londres » → London) : un préfixe peut tomber sur une variante rare.
    const alias = i > 0 && keys[i] === q ? (row[2 + i] as string) : undefined;
    out.push({ name, country, population, ...(alias ? { alias } : {}) });
    if (out.length >= limit) break;
  }
  return out;
}

/** Variante pour les tests : index construit à partir de lignes déjà chargées. */
export function indexCities(rows: Row[]): Indexed[] {
  return rows.map((row) => ({
    row,
    keys: [row[0], ...(row.slice(3) as string[])].map(normalizeCity),
  }));
}
