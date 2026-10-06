// Construit public/geo/cities.json à partir de GeoNames cities15000.txt
// (https://download.geonames.org/export/dump/, licence CC BY 4.0).
//
// Usage : node scripts/build-cities.mjs <chemin/vers/cities15000.txt>
//
// Garde, pour chaque ville : nom, code pays, population et, pour les villes
// de plus de 100 000 habitants, leurs noms en alphabet latin dans d'autres
// langues (ex. « Londres » pour London, « Munich » pour München), pour que la
// recherche marche en français comme en anglais. GeoNames n'indique pas la
// langue de ces noms : on les garde tous (hors codes d'aéroport).
// Format compact : [nom, pays, population, ...alternatifs].
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const source = process.argv[2];
if (!source) {
  console.error("usage : node scripts/build-cities.mjs <cities15000.txt>");
  process.exit(1);
}

const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
// Alphabet latin (avec accents), espaces, tirets, apostrophes, points.
const LATIN = /^[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿĀ-ž' .\-]+$/u;
const ALTS_MIN_POPULATION = 100_000;
const MAX_ALTS = 40;

const rows = [];
for (const line of readFileSync(source, "utf8").split("\n")) {
  if (!line) continue;
  const f = line.split("\t");
  const name = f[1];
  const country = f[8];
  const population = Number(f[14]) || 0;
  if (!name || !/^[A-Z]{2}$/.test(country)) continue;
  const seen = new Set([norm(name), norm(f[2])]);
  const alts = [];
  const candidates = population >= ALTS_MIN_POPULATION ? (f[3] || "").split(",") : [];
  for (const alt of candidates) {
    if (alts.length >= MAX_ALTS) break;
    if (!LATIN.test(alt) || alt.length > 40 || /^[A-Z]{2,4}$/.test(alt)) continue;
    const key = norm(alt);
    if (seen.has(key)) continue;
    seen.add(key);
    alts.push(alt);
  }
  rows.push([name, country, population, ...alts]);
}
// Les plus peuplées d'abord : la recherche s'arrête plus tôt et départage les homonymes.
rows.sort((a, b) => b[2] - a[2]);

mkdirSync("public/geo", { recursive: true });
writeFileSync("public/geo/cities.json", JSON.stringify(rows));
console.log(`${rows.length} villes`);
