// « Cette adresse a-t-elle servi hors de Huntited ? » — lecture de
// l'historique public d'une adresse du réseau de test, pour conseiller un
// compte dédié (voir docs/registre-kaspa.md).
//
// Passer par le serveur évite que l'API publique voie l'IP de la personne à
// côté de son adresse. Rien n'est conservé ni journalisé : ni l'adresse, ni
// le résultat.

/** Transaction telle que renvoyée par l'API REST Kaspa (champs utiles). */
export interface ApiTransaction {
  is_accepted?: boolean;
  inputs?: { previous_outpoint_address?: string | null }[] | null;
  outputs?: { script_public_key_address?: string | null }[] | null;
}

export type ExposureReason = "sent_elsewhere" | "many_sources";

export interface Exposure {
  usedElsewhere: boolean;
  reasons: ExposureReason[];
}

/**
 * Une adresse dédiée ne fait que : recevoir d'une seule source (faucet,
 * plateforme, ami) et envoyer vers Huntited (registre) ou vers elle-même
 * (monnaie rendue). Tout le reste la relie à d'autres activités.
 */
export function analyzeExposure(
  address: string,
  txs: readonly ApiTransaction[],
  huntitedAddresses: readonly string[] = [],
): Exposure {
  const allowed = new Set([address, ...huntitedAddresses]);
  const sources = new Set<string>();
  let sentElsewhere = false;
  for (const tx of txs) {
    if (tx.is_accepted === false) continue;
    const from = (tx.inputs ?? []).map((i) => i.previous_outpoint_address).filter(Boolean);
    if (from.includes(address)) {
      const to = (tx.outputs ?? []).map((o) => o.script_public_key_address).filter(Boolean);
      if (to.some((a) => !allowed.has(a!))) sentElsewhere = true;
    } else {
      for (const a of from) if (!huntitedAddresses.includes(a!)) sources.add(a!);
    }
  }
  const reasons: ExposureReason[] = [];
  if (sentElsewhere) reasons.push("sent_elsewhere");
  if (sources.size > 1) reasons.push("many_sources");
  return { usedElsewhere: reasons.length > 0, reasons };
}

/** Adresse du réseau de test uniquement (jamais mainnet). */
export const TESTNET_ADDRESS = /^kaspatest:[a-z0-9]{61,63}$/;

export class ExposureUnavailable extends Error {}

/** Lit les dernières transactions d'une adresse sur l'API REST publique. */
export async function fetchAddressTransactions(
  apiUrl: string,
  address: string,
  fetchFn: typeof fetch = fetch,
): Promise<ApiTransaction[]> {
  const url = `${apiUrl}/addresses/${encodeURIComponent(address)}/full-transactions?limit=100&resolve_previous_outpoints=light`;
  let res: Response;
  try {
    res = await fetchFn(url, { signal: AbortSignal.timeout(8000) });
  } catch {
    throw new ExposureUnavailable();
  }
  if (!res.ok) throw new ExposureUnavailable();
  const data = (await res.json().catch(() => null)) as unknown;
  if (!Array.isArray(data)) throw new ExposureUnavailable();
  return data as ApiTransaction[];
}
