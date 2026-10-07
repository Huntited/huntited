// Lecture publique de l'index du registre sur la chaîne :
//   GET /api/chain/status      → adresse du registre, avancement de l'index
//   GET /api/chain/hunts       → chasses (même forme que /api/hunts)
//   GET /api/chain/hunts/:id   → une chasse
// Aucune adresse n'est renvoyée (ni créateur, ni engagés) : elles sont sur la
// chaîne, mais Huntited ne les affiche jamais.
import { Router } from "express";

import type { ChainIndexer } from "../chain/indexer.js";
import type { LedgerHunt } from "../chain/ledger.js";
import { huntIdSchema } from "../chain/protocol.js";
import type { PublicHunt } from "../types/hunt.js";

export function chainRouter(deps: {
  indexer: ChainIndexer;
  registryAddress: string;
  now?: () => number;
}): Router {
  const { indexer } = deps;
  const now = deps.now ?? Date.now;
  const router = Router();

  const view = (h: LedgerHunt): PublicHunt => {
    const t = now();
    const { status, outcome } = indexer.ledger.status(h, t);
    const masked = h.progressVisibility === "hidden" && status === "active";
    const group = indexer.ledger.retainedGroup(h);
    return {
      id: h.id,
      title: h.title,
      description: h.description,
      location: h.location,
      ...(h.country ? { country: h.country } : {}),
      deadline: new Date(h.deadline).toISOString(),
      threshold: h.threshold,
      deposit: h.deposit,
      progressVisibility: h.progressVisibility,
      status: outcome ? "settled" : status,
      commitCount: masked ? null : h.commits.length,
      retainedCount: masked ? null : group.retainedCount,
      retainedThreshold: masked ? null : group.retainedThreshold,
      commitsOpen: t <= h.deadline,
      createdAt: new Date(h.createdAt).toISOString(),
      ...(h.activationRank !== undefined && !masked ? { activationRank: h.activationRank } : {}),
      ...(outcome ? { outcome, settledAt: new Date(h.deadline).toISOString() } : {}),
      ...(h.activatedAt !== undefined
        ? { activatedAt: new Date(h.activatedAt).toISOString() }
        : {}),
    };
  };

  router.get("/status", (_req, res) =>
    res.json({
      registryAddress: deps.registryAddress,
      appliedScore: indexer.appliedScore(),
      hunts: indexer.ledger.allHunts().length,
    }),
  );

  router.get("/hunts", (_req, res) => res.json(indexer.ledger.allHunts().map(view)));

  router.get("/hunts/:id", (req, res) => {
    const id = huntIdSchema.safeParse(req.params["id"]);
    const h = id.success ? indexer.ledger.hunt(id.data) : undefined;
    if (!h) return res.status(404).json({ error: "Chasse introuvable." });
    return res.json(view(h));
  });

  return router;
}
