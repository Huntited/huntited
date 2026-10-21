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
//
// Et dist-static/registry-snapshot.json : l'archive du registre au moment de
// la construction (couverte par le manifest, donc par l'ancrage), en plus de
// l'archive tenue à jour en ligne (CHAIN_ARCHIVE_URL, docs/archives.md).
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
const liveArchive =
  process.env.CHAIN_ARCHIVE_URL ?? "https://huntited.codeberg.page/registry-live.json";

Object.assign(process.env, {
  VITE_DATA_MODE: "chain",
  VITE_WALLET_MODE: "kastle",
  VITE_MATRIX_MODE: "mock",
  // Vide : aucun serveur Huntited (chat, notifications : bientôt).
  VITE_API_BASE_URL: "",
  VITE_HASH_ROUTING: "true",
  // Adresse(s) de publication : par défaut celle de huntited.kas
  // (src/lib/onchain/publisher.ts) ; RELEASE_PUBLISHERS pour la remplacer.
  VITE_RELEASE_PUBLISHERS: process.env.RELEASE_PUBLISHERS ?? "",
  VITE_APP_VERSION: version,
  // Archives du registre : celle livrée avec le site, puis celle en ligne.
  VITE_CHAIN_ARCHIVES: ["./registry-snapshot.json", liveArchive].filter(Boolean).join(","),
});

await build({ configFile: "vite.static.config.ts", mode: "production" });

// Fichiers du pass (en réserve, inutilisé ici) : 5,5 Mo de moins à publier.
rmSync(join(OUT, "zk"), { recursive: true, force: true });

// Politique de sécurité (CSP) : la page ne charge que ses propres fichiers,
// et ne contacte que les services listés (API Kaspa, relais Nostr du chat,
// archive en ligne). Limite les dégâts d'une injection de script.
const list = (raw, fallback) =>
  (raw || fallback)
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
const origin = (u) => {
  try {
    return new URL(u).origin;
  } catch {
    return null;
  }
};
const connect = [
  ...list(process.env.VITE_KASPA_API_URL, "https://api-tn10.kaspa.org").map(origin),
  ...list(
    process.env.VITE_NOSTR_RELAYS,
    "wss://relay.damus.io,wss://nos.lol,wss://relay.primal.net",
  ),
  origin(liveArchive),
].filter(Boolean);
const csp = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${[...new Set(connect)].join(" ")}`,
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");
const indexPath = join(OUT, "index.html");
writeFileSync(
  indexPath,
  readFileSync(indexPath, "utf8").replace(
    "<head>",
    `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`,
  ),
);

// Archive du registre livrée avec le site (l'API et l'archive en ligne, fusionnées).
execSync(
  `node scripts/archive-registry.mjs --out ${join(OUT, "registry-snapshot.json")} --from ${liveArchive} --allow-offline`,
  { stdio: "inherit" },
);

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
