// Archive du registre Huntited : garde toutes les transactions finales du
// registre, même quand l'API publique ne les liste plus (les nœuds effacent
// les vieux blocs ; l'API du réseau de test a été réinitialisée).
//
// Fusionne les archives existantes (--from, fichier ou adresse web, plusieurs
// possibles) avec ce que l'API liste maintenant, puis écrit le résultat
// (--out). On ne retire jamais rien : une archive ne fait que grandir.
// Format : voir docs/archives.md (identique à src/lib/onchain/indexer.ts).
//
// Usage :
//   node scripts/archive-registry.mjs --out registry.json \
//     [--from https://huntited.codeberg.page/registry-live.json] [--from fichier.json] \
//     [--api https://api-tn10.kaspa.org] [--allow-offline]
// Sans --allow-offline, rien n'est écrit si l'API ne répond pas.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const REGISTRY = "kaspatest:qr2ck8qnt0rtj7spzd7am9tsmtd5j4l3tgtah3tzz89l9jvcfg5uvc33cl3yj";
const FORMAT = "huntited-registry-archive";
/** Même profondeur de finalité que l'index (src/lib/onchain/indexer.ts). */
const FINALITY_DEPTH = 600;
const PAGE = 500;

const args = process.argv.slice(2);
const all = (name) => args.flatMap((a, i) => (a === name && args[i + 1] ? [args[i + 1]] : []));
const out = all("--out")[0];
const api = all("--api")[0] ?? "https://api-tn10.kaspa.org";
const allowOffline = args.includes("--allow-offline");
if (!out) {
  console.error("usage : node scripts/archive-registry.mjs --out <fichier> [--from …] [--api …]");
  process.exit(2);
}

const isEntry = (e) =>
  e &&
  typeof e.txId === "string" &&
  /^[0-9a-f]{64}$/.test(e.txId) &&
  Number.isSafeInteger(e.score) &&
  e.score > 0 &&
  typeof e.time === "number" &&
  Number.isFinite(e.time) &&
  e.time >= 0 &&
  typeof e.sender === "string" &&
  e.sender.length > 0 &&
  e.sender.length <= 100 &&
  typeof e.payload === "string" &&
  /^(?:[0-9a-f]{2})+$/.test(e.payload);

const get = async (url) => {
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
};

const entries = new Map();
const add = (e) => {
  if (isEntry(e) && !entries.has(e.txId)) entries.set(e.txId, e);
};

// 1. Ce que l'API liste maintenant (la vérité de la chaîne, quand elle l'a encore).
let fromApi = 0;
try {
  const final = (await get(`${api}/info/virtual-chain-blue-score`)).blueScore - FINALITY_DEPTH;
  for (let offset = 0; ; offset += PAGE) {
    const txs = await get(
      `${api}/addresses/${encodeURIComponent(REGISTRY)}/full-transactions?limit=${PAGE}&offset=${offset}&resolve_previous_outpoints=light`,
    );
    for (const tx of txs) {
      const score = tx.accepting_block_blue_score ?? 0;
      const sender = tx.inputs?.[0]?.previous_outpoint_address;
      if (!tx.is_accepted || score <= 0 || score > final || !sender || !tx.payload) continue;
      const before = entries.size;
      add({
        txId: tx.transaction_id,
        score,
        time: tx.accepting_block_time ?? 0,
        sender,
        payload: tx.payload.toLowerCase(),
      });
      fromApi += entries.size - before;
    }
    if (txs.length < PAGE) break;
  }
} catch (e) {
  console.error(`API injoignable (${e.message}).`);
  if (!allowOffline) process.exit(1);
}

// 2. Les archives existantes (ce que l'API a pu oublier).
for (const src of all("--from")) {
  try {
    const data = /^https?:\/\//.test(src)
      ? await get(src)
      : existsSync(src)
        ? JSON.parse(readFileSync(src, "utf8"))
        : null;
    if (!data) continue;
    if (data.format !== FORMAT || data.registry !== REGISTRY || !Array.isArray(data.entries)) {
      console.error(`Archive ignorée (format inconnu) : ${src}`);
      continue;
    }
    data.entries.forEach(add);
  } catch (e) {
    console.error(`Archive illisible : ${src} (${e.message})`);
  }
}

// 3. Écriture : ordre de la chaîne, une entrée par ligne (diffs lisibles).
const sorted = [...entries.values()].sort(
  (a, b) => a.score - b.score || (a.txId < b.txId ? -1 : a.txId > b.txId ? 1 : 0),
);
const body = sorted
  .map(({ txId, score, time, sender, payload }) =>
    JSON.stringify({ txId, score, time, sender, payload }),
  )
  .join(",\n    ");
writeFileSync(
  out,
  `{\n  "format": "${FORMAT}",\n  "version": 1,\n  "registry": "${REGISTRY}",\n  "entries": [${sorted.length ? `\n    ${body}\n  ` : ""}]\n}\n`,
);
console.log(`Archive : ${sorted.length} transaction(s), dont ${fromApi} lue(s) sur l'API → ${out}`);
