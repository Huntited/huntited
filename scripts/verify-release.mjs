// Vérifie qu'un site Huntited en ligne est bien une version officielle :
//  1. télécharge sa liste de fichiers (release.json) et chaque fichier ;
//  2. recalcule leurs empreintes (sha256) et celle de la liste ;
//  3. compare avec la version ancrée sur Kaspa par l'adresse de publication.
//
// Usage :
//   node scripts/verify-release.mjs <adresse-du-site> --publisher kaspatest:… [--api https://…]
// Exemple :
//   node scripts/verify-release.mjs https://dweb.link/ipfs/bafy…/ --publisher kaspatest:qq…
import { createHash } from "node:crypto";

const REGISTRY = "kaspatest:qr2ck8qnt0rtj7spzd7am9tsmtd5j4l3tgtah3tzz89l9jvcfg5uvc33cl3yj";
const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const site = args.find((a) => /^https?:\/\//.test(a) && a !== opt("--api"));
const publishers = (opt("--publisher") ?? process.env.RELEASE_PUBLISHERS ?? "")
  .split(",")
  .filter(Boolean);
const api = opt("--api") ?? "https://api-tn10.kaspa.org";
if (!site || publishers.length === 0) {
  console.error("usage : node scripts/verify-release.mjs <site> --publisher kaspatest:…");
  process.exit(2);
}
const base = site.split("#")[0].replace(/\/?$/, "/");
const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const get = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res;
};

// 1–2. Fichiers servis par le site.
const release = await (await get(`${base}release.json`)).json();
console.log(`Version annoncée : ${release.version}`);
let bad = 0;
for (const f of release.files) {
  const actual = sha256(Buffer.from(await (await get(base + f.path)).arrayBuffer()));
  if (actual !== f.sha256) {
    bad++;
    console.log(`  ✗ fichier modifié : ${f.path}`);
  }
}
const manifest = sha256(release.files.map((f) => `${f.sha256}  ${f.path}\n`).join(""));
if (manifest !== release.manifest) {
  console.log("  ✗ la liste de fichiers ne correspond pas à son empreinte");
  bad++;
}
console.log(
  bad ? `Fichiers : ${bad} problème(s)` : `Fichiers : ${release.files.length} identiques ✓`,
);

// 3. Versions ancrées sur Kaspa par l'adresse de publication.
const anchored = [];
for (let offset = 0; ; offset += 500) {
  const txs = await (
    await get(
      `${api}/addresses/${encodeURIComponent(REGISTRY)}/full-transactions?limit=500&offset=${offset}&resolve_previous_outpoints=light`,
    )
  ).json();
  for (const tx of txs) {
    const sender = tx.inputs?.[0]?.previous_outpoint_address;
    if (!tx.is_accepted || !publishers.includes(sender) || !tx.payload) continue;
    try {
      const text = Buffer.from(tx.payload, "hex").toString("utf8");
      if (!text.startsWith("HNT1")) continue;
      const m = JSON.parse(text.slice(4));
      if (m.t === "release") anchored.push({ ...m, txId: tx.transaction_id });
    } catch {
      /* message illisible : ignoré */
    }
  }
  if (txs.length < 500) break;
}
const match = anchored.find((r) => r.version === release.version);
if (!match) {
  console.log("Blockchain : cette version n'est pas ancrée ✗");
  process.exit(1);
}
const ok = match.manifest === manifest && bad === 0;
console.log(
  ok
    ? `Blockchain : version officielle ✓ (transaction ${match.txId})`
    : "Blockchain : l'empreinte ancrée ne correspond pas à ce site ✗",
);
process.exit(ok ? 0 : 1);
