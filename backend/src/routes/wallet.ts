// POST /api/wallet/exposure { address } → { usedElsewhere, reasons }
// Conseil « compte dédié » : l'adresse a-t-elle servi hors de Huntited ?
// Rien n'est conservé ni journalisé (voir services/address-exposure.ts).
import { Router } from "express";
import { z } from "zod";

import { rateLimit } from "../middleware/rate-limit.js";
import {
  analyzeExposure,
  ExposureUnavailable,
  fetchAddressTransactions,
  TESTNET_ADDRESS,
} from "../services/address-exposure.js";

export function walletRouter(deps: {
  /** API REST Kaspa du réseau de test. */
  apiUrl: string;
  /** Adresses de Huntited (registre), qui ne comptent pas comme « ailleurs ». */
  huntitedAddresses?: string[];
  fetch?: typeof fetch;
  rateLimitMultiplier?: number;
}): Router {
  const router = Router();
  const limiter = rateLimit({ windowMs: 60_000, max: 10 * (deps.rateLimitMultiplier ?? 1) });

  router.post("/exposure", limiter, async (req, res, next) => {
    const parsed = z.object({ address: z.string().regex(TESTNET_ADDRESS) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Requête invalide." });
    try {
      const txs = await fetchAddressTransactions(deps.apiUrl, parsed.data.address, deps.fetch);
      return res.json(analyzeExposure(parsed.data.address, txs, deps.huntitedAddresses));
    } catch (e) {
      if (e instanceof ExposureUnavailable) {
        return res.status(503).json({ error: "Vérification indisponible." });
      }
      return next(e);
    }
  });

  return router;
}
