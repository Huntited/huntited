// ============= Full file contents =============

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getHunts, type HuntFilters } from "@/lib/registry";
import { getCommitCount, onCommitmentsChange, type CovenantStatus } from "@/lib/covenants";
import { useWallet } from "@/lib/useWallet";
import type { Hunt } from "@/lib/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Huntited — Chasses actives" },
      { name: "description", content: "Rejoins des actions collectives de façon privée et atomique : tout le monde ensemble, ou personne." },
      { property: "og:title", content: "Huntited — Chasses actives" },
      { property: "og:description", content: "Coordination décentralisée d'actions collectives, engagements privés." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

/** Tronque une adresse pour l'affichage (kaspa:abcd…wxyz). */
const shortAddress = (a: string) => `${a.slice(0, 10)}…${a.slice(-4)}`;

/** Valeur du sélecteur de statut : "all" (aucun filtre) ou un statut. */
type StatusFilter = CovenantStatus | "all";

/** Titre de la section de liste, adapté au filtre de statut choisi. */
function sectionTitle(status: StatusFilter, search: string): string {
  if (search.trim()) return "Résultats";
  switch (status) {
    case "active":
      return "Chasses actives";
    case "activated":
      return "Chasses activées";
    case "expired":
      return "Chasses expirées";
    case "all":
      return "Toutes les chasses";
  }
}

function Index() {
  const { isConnected, address, isLoading, connectWallet, disconnectWallet } = useWallet();

  // Filtres contrôlés : recherche plein texte + statut.
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Liste lue après hydratation (les chasses créées sont en localStorage),
  // recalculée à chaque changement de filtre.
  const [hunts, setHunts] = useState<Hunt[] | null>(null);

  useEffect(() => {
    // Filtres construits conditionnellement (exactOptionalPropertyTypes :
    // on ne passe pas de valeur undefined explicite).
    const filters: HuntFilters = {};
    if (statusFilter !== "all") filters.status = statusFilter;
    if (search) filters.search = search;
    const load = () => setHunts(getHunts(filters));
    load();
    // Rechargement quand un engagement change le compteur.
    return onCommitmentsChange(load);
  }, [search, statusFilter]);

  const hasNoResults = hunts !== null && hunts.length === 0;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">Huntited</h1>
        <div className="flex items-center gap-3">
          <Link to="/my-hunts" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            Mes chasses
          </Link>
          {isConnected && address ? (
            <div className="flex items-center gap-2">
              <code className="hidden text-xs text-muted-foreground sm:inline">{shortAddress(address)}</code>
              <Button variant="outline" size="sm" onClick={disconnectWallet}>Déconnecter</Button>
            </div>
          ) : (
            <Button size="sm" onClick={() => connectWallet()} disabled={isLoading}>
              {isLoading ? "Connexion…" : "Connecter le wallet"}
            </Button>
          )}
        </div>
      </header>

      <p className="mt-3 text-muted-foreground">
        Coordination décentralisée d'actions collectives : engagements privés,
        déclenchement atomique, aucun organisateur central.
      </p>

      <div className="mt-6">
        <Button asChild><Link to="/create">Créer une chasse</Link></Button>
      </div>

      {/* Filtres : recherche + statut */}
      <section className="mt-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Recherche plein texte (titre, lieu, description) — filtrage
              local uniquement, rien n'est envoyé nulle part. */}
          <Input
            type="search"
            placeholder="Rechercher une chasse…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
            aria-label="Rechercher une chasse"
          />
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-full sm:w-44" aria-label="Filtrer par statut">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="active">Actives</SelectItem>
              <SelectItem value="activated">Activées</SelectItem>
              <SelectItem value="expired">Expirées</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <h2 className="mt-6 text-lg font-semibold">{sectionTitle(statusFilter, search)}</h2>
        {hunts === null ? (
          <p className="mt-3 text-sm text-muted-foreground">Chargement…</p>
        ) : hasNoResults ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {search.trim() || statusFilter !== "all"
              ? "Aucune chasse ne correspond à ces filtres."
              : "Aucune chasse pour le moment."}
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {hunts.map((h) => (
              <li key={h.id}>
                <Link
                  to="/hunt/$id"
                  params={{ id: h.id }}
                  className="block rounded-lg border p-4 transition-colors hover:bg-accent"
                >
                  <div className="font-medium">{h.title}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {h.location} · avant le{" "}
                    {new Date(h.deadline).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}
                  </div>
                  <div className="mt-1 text-sm">{getCommitCount(h)} sur {h.threshold} engagés</div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
