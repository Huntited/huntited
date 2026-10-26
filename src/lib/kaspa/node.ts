// Nœuds Kaspa publics (wallet intégré, docs/wallet.md) : un « resolver »
// donne l'adresse d'un nœud, joint ensuite en wRPC JSON par WebSocket.
// L'API REST ne sert pas pour l'envoi : elle perd le message (payload) des
// transactions, que le registre Huntited utilise.
import type { Utxo } from "./tx";

/** Resolvers publics de la communauté Kaspa (ceux du SDK officiel). */
const RESOLVERS = ["eric.kaspa.stream", "maxim.kaspa.stream", "troy.kaspa.stream"];

/** Domaines des nœuds publics (CSP du site : scripts/build-static.mjs). */
export const NODE_DOMAINS = ["kaspa.stream", "kaspa.red", "kaspa.green", "kaspa.blue"];

const TIMEOUT_MS = 20_000;

async function nodeUrl(network: string): Promise<string> {
  const order = [...RESOLVERS].sort(() => Math.random() - 0.5);
  for (const host of order) {
    try {
      const r = await fetch(`https://${host}/v2/kaspa/${network}/tls/wrpc/borsh`);
      const { url } = (await r.json()) as { url?: string };
      if (typeof url === "string" && url.startsWith("wss://"))
        return url.replace(/\/borsh$/, "/json");
    } catch {
      /* resolver suivant */
    }
  }
  throw new Error("no_node");
}

/** Un appel wRPC (connexion ouverte puis fermée). */
async function call<T>(network: string, method: string, params: unknown): Promise<T> {
  const url = await nodeUrl(network);
  return new Promise<T>((resolve, reject) => {
    const ws = new WebSocket(url);
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error("node_timeout"));
    }, TIMEOUT_MS);
    ws.onopen = () => ws.send(JSON.stringify({ id: 1, method, params }));
    ws.onmessage = (m) => {
      clearTimeout(timer);
      ws.close();
      try {
        const msg = JSON.parse(String(m.data)) as { params?: T; error?: unknown };
        if (msg.error !== undefined && msg.error !== null)
          reject(new Error(String(JSON.stringify(msg.error))));
        else resolve(msg.params as T);
      } catch (e) {
        reject(e instanceof Error ? e : new Error("bad_reply"));
      }
    };
    ws.onerror = () => {
      clearTimeout(timer);
      reject(new Error("node_unreachable"));
    };
  });
}

export async function getUtxos(network: string, address: string): Promise<Utxo[]> {
  const res = await call<{
    entries: {
      outpoint: { transactionId: string; index: number };
      utxoEntry: { amount: number | string; scriptPublicKey: string };
    }[];
  }>(network, "getUtxosByAddresses", { addresses: [address] });
  return res.entries.map((e) => ({
    transactionId: e.outpoint.transactionId,
    index: e.outpoint.index,
    amount: BigInt(e.utxoEntry.amount),
    // « 0000 » + script : la version (2 octets) est retirée.
    script: e.utxoEntry.scriptPublicKey.slice(4),
  }));
}

export async function submitTransaction(network: string, transaction: unknown): Promise<string> {
  const res = await call<{ transactionId: string }>(network, "submitTransaction", {
    transaction,
    allowOrphan: false,
  });
  return res.transactionId;
}
