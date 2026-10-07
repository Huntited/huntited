// Index du registre dans le navigateur : lit directement, sur l'API publique
// du réseau de test, les transactions envoyées à l'adresse du registre, et les
// rejoue dans le grand livre. Aucun serveur Huntited : chaque navigateur
// recalcule l'état lui-même, et obtient le même que tous les autres.
// ⚠️ Copie conforme de backend/src/chain/indexer.ts (même ordre, même
// finalité, même tolérance au retard de l'API).
import { hexToBytes } from "@noble/hashes/utils.js";

import type { ChainEvent, Ledger } from "./ledger";

export interface RestTransaction {
  transaction_id: string;
  is_accepted?: boolean;
  accepting_block_blue_score?: number | null;
  accepting_block_time?: number | null;
  payload?: string | null;
  inputs?: { previous_outpoint_address?: string | null }[] | null;
}

export interface ChainSource {
  virtualBlueScore(): Promise<number>;
  addressTransactionCount(address: string): Promise<number>;
  addressTransactions(address: string, offset: number, limit: number): Promise<RestTransaction[]>;
}

/** Source : API REST publique (réseau de test). Ne reçoit que l'adresse du registre. */
export function restSource(apiUrl: string, fetchFn: typeof fetch = fetch): ChainSource {
  const get = async <T>(path: string): Promise<T> => {
    const res = await fetchFn(apiUrl + path, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`chain_api_${res.status}`);
    return (await res.json()) as T;
  };
  return {
    virtualBlueScore: async () =>
      (await get<{ blueScore: number }>("/info/virtual-chain-blue-score")).blueScore,
    addressTransactionCount: async (address) =>
      (await get<{ total: number }>(`/addresses/${encodeURIComponent(address)}/transactions-count`))
        .total,
    addressTransactions: (address, offset, limit) =>
      get<RestTransaction[]>(
        `/addresses/${encodeURIComponent(address)}/full-transactions?limit=${limit}&offset=${offset}&resolve_previous_outpoints=light`,
      ),
  };
}

export const FINALITY_DEPTH = 600;
const PAGE = 500;
const MAX_PAGES = 200;

type ScoredEvent = ChainEvent & { score: number };
const byChainOrder = (a: ScoredEvent, b: ScoredEvent) =>
  a.score - b.score || (a.txId < b.txId ? -1 : a.txId > b.txId ? 1 : 0);

export class ChainIndexer {
  private current: Ledger;
  private readonly known = new Map<string, ScoredEvent>();
  private maxScore = 0;
  private lastCount = -1;
  private hasUnfinal = false;
  private running: Promise<number> | null = null;

  constructor(
    private readonly source: ChainSource,
    private readonly registry: string,
    private readonly newLedger: () => Ledger,
    private readonly finalityDepth = FINALITY_DEPTH,
  ) {
    this.current = newLedger();
  }

  get ledger(): Ledger {
    return this.current;
  }

  sync(): Promise<number> {
    this.running ??= this.doSync().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async doSync(): Promise<number> {
    const count = await this.source.addressTransactionCount(this.registry);
    if (count === this.lastCount && !this.hasUnfinal) return 0;
    const final = (await this.source.virtualBlueScore()) - this.finalityDepth;

    const fresh: ScoredEvent[] = [];
    let unfinal = false;
    let seen = 0;
    for (let page = 0; page < MAX_PAGES; page++) {
      const txs = await this.source.addressTransactions(this.registry, page * PAGE, PAGE);
      seen += txs.length;
      for (const tx of txs) {
        if (this.known.has(tx.transaction_id) || !tx.is_accepted) continue;
        const score = tx.accepting_block_blue_score ?? 0;
        if (score <= 0) continue;
        if (score > final) {
          unfinal = true;
          continue;
        }
        const sender = tx.inputs?.[0]?.previous_outpoint_address;
        if (!sender || !tx.payload || !/^(?:[0-9a-f]{2})+$/i.test(tx.payload)) continue;
        fresh.push({
          score,
          txId: tx.transaction_id,
          time: tx.accepting_block_time ?? 0,
          sender,
          payload: hexToBytes(tx.payload.toLowerCase()),
        });
      }
      if (txs.length < PAGE || seen >= count) break;
    }
    this.hasUnfinal = unfinal;
    this.lastCount = count;
    if (fresh.length === 0) return 0;

    for (const e of fresh) this.known.set(e.txId, e);
    fresh.sort(byChainOrder);
    if (fresh[0]!.score <= this.maxScore) {
      const ledger = this.newLedger();
      for (const e of [...this.known.values()].sort(byChainOrder)) await ledger.apply(e);
      this.current = ledger;
    } else {
      for (const e of fresh) await this.current.apply(e);
    }
    this.maxScore = Math.max(this.maxScore, fresh.at(-1)!.score);
    return fresh.length;
  }
}
