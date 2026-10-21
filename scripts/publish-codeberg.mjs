// Publie dist-static/ sur Codeberg Pages (dépôt Huntited/pages, branche
// « pages »), en gardant l'archive en ligne du registre (registry-live.json,
// tenue à jour par .github/workflows/archive.yml).
//
// Prérequis : npm run build:static, et .env.publish avec CODEBERG_USER et
// CODEBERG_TOKEN (jamais affichés, jamais versionnés).
// Usage : node scripts/publish-codeberg.mjs
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const env = Object.fromEntries(
  readFileSync(".env.publish", "utf8")
    .split(/\r?\n/)
    .map((l) => l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);
const user = env.CODEBERG_USER;
const token = env.CODEBERG_TOKEN;
if (!user || !token) throw new Error(".env.publish : CODEBERG_USER et CODEBERG_TOKEN requis");
if (!existsSync("dist-static/release.json")) throw new Error("lancer d'abord npm run build:static");
const { version } = JSON.parse(readFileSync("dist-static/release.json", "utf8"));

const repo = `https://codeberg.org/${user}/pages.git`;
const auth = ["-c", `http.extraHeader=Authorization: token ${token}`];
const dir = mkdtempSync(join(tmpdir(), "huntited-pages-"));
const git = (...args) => execFileSync("git", ["-C", dir, ...args], { stdio: "pipe" });
try {
  execFileSync("git", [...auth, "clone", "--quiet", "--branch", "pages", repo, dir], {
    stdio: "pipe",
  });
  // Remplace le site, garde l'archive en ligne.
  for (const name of readdirSync(dir)) {
    if (name !== ".git" && name !== "registry-live.json") {
      rmSync(join(dir, name), { recursive: true, force: true });
    }
  }
  cpSync("dist-static", dir, { recursive: true });
  // Archive en ligne : la complète (ou la crée) avec l'API et l'archive du site.
  const live = join(dir, "registry-live.json");
  execFileSync(
    "node",
    [
      "scripts/archive-registry.mjs",
      "--out",
      live,
      "--from",
      live,
      "--from",
      "dist-static/registry-snapshot.json",
      "--allow-offline",
    ],
    { stdio: "inherit" },
  );
  git("add", "-A");
  try {
    git("diff", "--cached", "--quiet");
    console.log(`Rien à publier : ${version} est déjà en ligne.`);
  } catch {
    git(
      "-c",
      `user.name=${user}`,
      "-c",
      `user.email=${user.toLowerCase()}@noreply.codeberg.org`,
      "commit",
      "--quiet",
      "-m",
      `Huntited ${version}`,
    );
    git(...auth, "push", "--quiet", "origin", "pages");
    console.log(`Publié : ${version} → https://${user.toLowerCase()}.codeberg.page/`);
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
