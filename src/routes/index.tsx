import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { HuntStatusBadge } from "@/components/hunt/HuntStatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CovenantStatus } from "@/lib/covenants";
import { isProgressVisible } from "@/lib/hunt-lifecycle";
import { listHuntViews, onHuntsChange, type HuntView } from "@/lib/hunt-repository";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { filterHuntViews, type HuntFilters } from "@/lib/registry";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Huntited — Agir ensemble, sans y aller seul" },
      {
        name: "description",
        content: "Rejoins des actions collectives en privé : tout le monde ensemble, ou personne.",
      },
      { property: "og:title", content: "Huntited" },
      {
        property: "og:description",
        content: "Rejoins des actions collectives en privé : tout le monde ensemble, ou personne.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

/** Valeur du sélecteur de statut : "all" (aucun filtre) ou un statut. */
type StatusFilter = CovenantStatus | "all";

const SECTION_TITLE: Record<StatusFilter, MessageKey> = {
  all: "home.section.all",
  active: "home.section.active",
  activated: "home.section.activated",
  expired: "home.section.expired",
};

const STEPS: { title: MessageKey; text: MessageKey }[] = [
  { title: "home.step1.title", text: "home.step1.text" },
  { title: "home.step2.title", text: "home.step2.text" },
  { title: "home.step3.title", text: "home.step3.text" },
];

function Index() {
  const { t, date } = useI18n();

  // Filtres contrôlés : recherche plein texte + statut.
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Liste lue après hydratation (les chasses créées sont en localStorage),
  // recalculée à chaque changement de filtre.
  const [hunts, setHunts] = useState<HuntView[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    // Filtres construits conditionnellement (exactOptionalPropertyTypes :
    // on ne passe pas de valeur undefined explicite).
    const filters: HuntFilters = {};
    if (statusFilter !== "all") filters.status = statusFilter;
    if (search) filters.search = search;
    let cancelled = false;
    const load = () => {
      listHuntViews()
        .then((views) => {
          if (cancelled) return;
          setLoadError(false);
          setHunts(filterHuntViews(views, filters));
        })
        .catch(() => {
          if (cancelled) return;
          setLoadError(true);
          setHunts([]);
        });
    };
    load();
    // Rechargement quand un engagement ou une chasse change.
    const unsubscribe = onHuntsChange(load);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [search, statusFilter]);

  const hasNoResults = hunts !== null && hunts.length === 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {/* Présentation */}
      <section>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("home.title")}</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">{t("home.lead")}</p>
        <Button asChild className="mt-5">
          <Link to="/create">{t("home.create")}</Link>
        </Button>
        <ol className="mt-8 grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-3 sm:flex-col sm:gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-semibold">{t(step.title)}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{t(step.text)}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Filtres : recherche + statut */}
      <section className="mt-12">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Recherche plein texte (titre, lieu, description) — filtrage
              local uniquement, rien n'est envoyé nulle part. */}
          <Input
            type="search"
            placeholder={t("home.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
            aria-label={t("home.search")}
          />
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-full sm:w-44" aria-label={t("home.filter")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("home.filter.all")}</SelectItem>
              <SelectItem value="active">{t("home.filter.active")}</SelectItem>
              <SelectItem value="activated">{t("home.filter.activated")}</SelectItem>
              <SelectItem value="expired">{t("home.filter.expired")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <h2 className="mt-6 text-lg font-semibold">
          {t(search.trim() ? "home.section.results" : SECTION_TITLE[statusFilter])}
        </h2>
        {hunts === null ? (
          <p className="mt-3 text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : hasNoResults ? (
          <p className="mt-3 text-sm text-muted-foreground" role={loadError ? "alert" : undefined}>
            {loadError
              ? t("home.loadError")
              : search.trim() || statusFilter !== "all"
                ? t("home.noMatch")
                : t("home.empty")}
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {hunts.map(({ hunt: h, status, commitCount }) => (
              <li key={h.id}>
                <Link
                  to="/hunt/$id"
                  params={{ id: h.id }}
                  className="block rounded-lg border p-4 transition-colors hover:bg-accent"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-medium">{h.title}</span>
                    <HuntStatusBadge status={status} />
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {h.location} ·{" "}
                    {t("home.card.before", {
                      date: date(h.deadline, { dateStyle: "medium", timeStyle: "short" }),
                    })}
                  </div>
                  <div className="mt-1 text-sm">
                    {isProgressVisible(h, status) && commitCount !== null
                      ? t("home.card.progress", { count: commitCount, threshold: h.threshold })
                      : t("home.card.hidden", { threshold: h.threshold })}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
