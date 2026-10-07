// Construit la version statique de Huntited (dossier dist-static/), à publier
// sur IPFS ou chez n'importe quel hébergeur de fichiers (voir docs/ipfs.md).
//
// Réglages : registre sur la blockchain (réseau de test), wallet Kastle, aucun
// serveur Huntited, navigation par « # ».
//
// Produit aussi dist-static/release.json : la liste des fichiers avec leur
// empreinte (sha256), et l'empreinte de cette liste (« manifest »), à ancrer
// sur Kaspa (page #/publish) et que n'importe qui peut revérifier
// (scripts/verify-release.mjs).
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { build } from "vite";

const OUT = "dist-static";
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
let commit = "local";
try {
  commit = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
} catch {
  /* pas de dépôt git : version locale */
}
const version = `${pkg.version ?? "0.0.0"}+${commit}`;

Object.assign(process.env, {
  VITE_DATA_MODE: "chain",
  VITE_WALLET_MODE: "kastle",
  VITE_MATRIX_MODE: "mock",
  // Vide : aucun serveur Huntited (chat, notifications : bientôt).
  VITE_API_BASE_URL: "",
  VITE_HASH_ROUTING: "true",
  // Adresse(s) de publication officielle (ex. RELEASE_PUBLISHERS=kaspatest:…) :
  // le site affiche si sa version est ancrée par elle.
  VITE_RELEASE_PUBLISHERS: process.env.RELEASE_PUBLISHERS ?? "",
  VITE_APP_VERSION: version,
});

await build({ configFile: "vite.static.config.ts", mode: "production" });

// Fichiers du pass (en réserve, inutilisé ici) : 5,5 Mo de moins à publier.
rmSync(join(OUT, "zk"), { recursive: true, force: true });

const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const files = walk(OUT)
  .map((p) => relative(OUT, p).split(sep).join("/"))
  .filter((p) => p !== "release.json")
  .sort()
  .map((path) => ({ path, sha256: sha256(readFileSync(join(OUT, path))) }));
// Format canonique : « empreinte  chemin » par ligne, triées par chemin.
const manifestText = files.map((f) => `${f.sha256}  ${f.path}\n`).join("");
const manifest = sha256(manifestText);
writeFileSync(
  join(OUT, "release.json"),
  JSON.stringify({ app: "Huntited", version, manifest, files }, null, 2),
);

console.log(`Version statique prête : ${OUT}/`);
console.log(`  version  : ${version}`);
console.log(`  manifest : ${manifest}`);
