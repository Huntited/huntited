// Index du registre : lit, sur l'API publique du réseau de test, les
// transactions envoyées à l'adresse du registre, et les rejoue dans le grand
// livre (ledger.ts). N'importe qui peut faire tourner cet index : il n'a aucun
// secret et obtient le même état que tous les autres.
//
// Ordre : score « blue » du bloc qui accepte la transaction, puis identifiant
// (déterministe). Seules les transactions « finales » sont rejouées (assez
// loin derrière la pointe du réseau pour ne plus bouger).
//
// L'API publique peut lister une transaction avec du retard (constaté : plus
// d'une minute). L'index ne s'arrête donc pas à « ce qui est plus vieux que le
// dernier rejoué » : quand le compteur de l'adresse change, il relit toute la
// liste, et si une transaction arrive « dans le passé », il recalcule tout
// l'état dans l'ordre (même résultat pour tous, quel que soit le retard).
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
  /** Nombre de transactions connues de l'API pour une adresse. */
  addressTransactionCount(address: string): Promise<number>;
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
    addressTransactionCount: async (address) =>
      (await get<{ total: number }>(`/addresses/${encodeURIComponent(address)}/transactions-count`))
        .total,
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

type ScoredEvent = ChainEvent & { score: number };
// Comparaison stricte (pas localeCompare, qui dépend de la langue de la machine).
const byChainOrder = (a: ScoredEvent, b: ScoredEvent) =>
  a.score - b.score || (a.txId < b.txId ? -1 : a.txId > b.txId ? 1 : 0);

export class ChainIndexer {
  private current: Ledger;
  /** Transactions finales déjà rejouées, par identifiant. */
  private readonly known = new Map<string, ScoredEvent>();
  /** Plus haut score rejoué. */
  private maxScore = 0;
  /** Compteur de l'API au dernier passage complet (rien de nouveau s'il n'a pas bougé). */
  private lastCount = -1;
  private hasUnfinal = false;
  private running: Promise<number> | null = null;

  constructor(
    private readonly source: ChainSource,
    private readonly registry: string,
    /** Fabrique d'un grand livre vide (pour tout recalculer dans l'ordre). */
    private readonly newLedger: () => Ledger,
    private readonly finalityDepth = FINALITY_DEPTH,
  ) {
    this.current = newLedger();
  }

  /** Grand livre courant (remplacé en cas de recalcul complet). */
  get ledger(): Ledger {
    return this.current;
  }

  appliedScore(): number {
    return this.maxScore;
  }

  /** Rejoue les nouvelles transactions finales ; renvoie leur nombre. */
  sync(): Promise<number> {
    this.running ??= this.doSync().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async doSync(): Promise<number> {
    const count = await this.source.addressTransactionCount(this.registry);
    // Rien de nouveau, et plus aucune transaction en attente de finalité.
    if (count === this.lastCount && !this.hasUnfinal) return 0;
    const final = (await this.source.virtualBlueScore()) - this.finalityDepth;

    // Relecture complète de la liste (une transaction peut y apparaître en retard).
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
      // Arrivée « dans le passé » : tout recalculer dans l'ordre de la chaîne.
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
