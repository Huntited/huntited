// Index du registre : lit, sur l'API publique du réseau de test, les
// transactions envoyées à l'adresse du registre, et les rejoue dans le grand
// livre (ledger.ts). N'importe qui peut faire tourner cet index : il n'a aucun
// secret et obtient le même état que tous les autres.
//
// Ordre : score « blue » du bloc qui accepte la transaction, puis identifiant
// (déterministe). Seules les transactions « finales » sont rejouées (assez
// loin derrière la pointe du réseau pour ne plus bouger).
import { hexToBytes } from "@noble/hashes/utils.js";

import type { ChainEvent, Ledger } from "./ledger.js";

/** Transaction telle que renvoyée par l'API REST Kaspa (champs utiles). */
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
  /** Transactions d'une adresse, des plus récentes aux plus anciennes. */
  addressTransactions(address: string, offset: number, limit: number): Promise<RestTransaction[]>;
}

/** Source : API REST publique (https://api-tn10.kaspa.org pour le réseau de test). */
export function restSource(apiUrl: string, fetchFn: typeof fetch = fetch): ChainSource {
  const get = async <T>(path: string): Promise<T> => {
    const res = await fetchFn(apiUrl + path, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`chain_api_${res.status}`);
    return (await res.json()) as T;
  };
  return {
    virtualBlueScore: async () =>
      (await get<{ blueScore: number }>("/info/virtual-chain-blue-score")).blueScore,
    addressTransactions: (address, offset, limit) =>
      get<RestTransaction[]>(
        `/addresses/${encodeURIComponent(address)}/full-transactions?limit=${limit}&offset=${offset}&resolve_previous_outpoints=light`,
      ),
  };
}

/** Profondeur de finalité, en score « blue » (≈ 1 min à 10 blocs/s). */
export const FINALITY_DEPTH = 600;
const PAGE = 500;
const MAX_PAGES = 200;

export class ChainIndexer {
  /** Score jusqu'auquel tout a été rejoué. */
  private applied = 0;
  private running: Promise<number> | null = null;

  constructor(
    private readonly source: ChainSource,
    private readonly registry: string,
    readonly ledger: Ledger,
    private readonly finalityDepth = FINALITY_DEPTH,
  ) {}

  appliedScore(): number {
    return this.applied;
  }

  /** Rejoue les nouvelles transactions finales ; renvoie leur nombre. */
  sync(): Promise<number> {
    this.running ??= this.doSync().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async doSync(): Promise<number> {
    const final = (await this.source.virtualBlueScore()) - this.finalityDepth;
    if (final <= this.applied) return 0;

    // Des plus récentes aux plus anciennes, jusqu'à ce qui est déjà rejoué.
    const fresh = new Map<string, RestTransaction>();
    for (let page = 0; page < MAX_PAGES; page++) {
      const txs = await this.source.addressTransactions(this.registry, page * PAGE, PAGE);
      for (const tx of txs) fresh.set(tx.transaction_id, tx);
      const oldest = txs.at(-1)?.accepting_block_blue_score ?? 0;
      if (txs.length < PAGE || (oldest !== 0 && oldest <= this.applied)) break;
    }

    const events: (ChainEvent & { score: number })[] = [];
    for (const tx of fresh.values()) {
      const score = tx.accepting_block_blue_score ?? 0;
      if (!tx.is_accepted || score <= this.applied || score > final) continue;
      const sender = tx.inputs?.[0]?.previous_outpoint_address;
      if (!sender || !tx.payload || !/^(?:[0-9a-f]{2})+$/i.test(tx.payload)) continue;
      events.push({
        score,
        txId: tx.transaction_id,
        time: tx.accepting_block_time ?? 0,
        sender,
        payload: hexToBytes(tx.payload.toLowerCase()),
      });
    }
    events.sort((a, b) => a.score - b.score || a.txId.localeCompare(b.txId));
    for (const e of events) await this.ledger.apply(e);
    this.applied = final;
    return events.length;
  }
}
