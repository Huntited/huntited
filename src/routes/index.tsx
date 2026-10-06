import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { EmptyState } from "@/components/EmptyState";
import { HuntCard } from "@/components/hunt/HuntCard";
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
import { listHuntViews, onHuntsChange, type HuntView } from "@/lib/hunt-repository";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { isCountryCode, sortedCountries } from "@/lib/countries";
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

function Index() {
  const { t } = useI18n();

  const { locale } = useI18n();
  // Filtres contrôlés : recherche plein texte, statut, pays.
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [countryFilter, setCountryFilter] = useState("all");

  // Toutes les chasses, lues après hydratation (les chasses créées sont en
  // localStorage) ; les filtres s'appliquent à l'affichage.
  const [all, setAll] = useState<HuntView[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      listHuntViews()
        .then((views) => {
          if (cancelled) return;
          setLoadError(false);
          setAll(views);
        })
        .catch(() => {
          if (cancelled) return;
          setLoadError(true);
          setAll([]);
        });
    };
    load();
    // Rechargement quand un engagement ou une chasse change.
    const unsubscribe = onHuntsChange(load);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  // Filtres construits conditionnellement (exactOptionalPropertyTypes :
  // on ne passe pas de valeur undefined explicite).
  const filters: HuntFilters = {};
  if (statusFilter !== "all") filters.status = statusFilter;
  if (search) filters.search = search;
  if (countryFilter !== "all") filters.country = countryFilter;
  const hunts = all === null ? null : filterHuntViews(all, filters);
  // Seuls les pays où il existe des chasses sont proposés dans le filtre.
  const countries = sortedCountries(locale, [
    ...new Set((all ?? []).map((v) => v.hunt.country).filter(isCountryCode)),
  ]);
  const filtering = search.trim() !== "" || statusFilter !== "all" || countryFilter !== "all";

  const hasNoResults = hunts !== null && hunts.length === 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {/* Présentation */}
      <section>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("home.title")}</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">{t("home.lead")}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button asChild>
            <a href="#hunts">{t("home.browse")}</a>
          </Button>
          <Button asChild variant="outline">
            <Link to="/create">{t("home.create")}</Link>
          </Button>
        </div>
      </section>

      {/* Un exemple concret plutôt qu'un schéma */}
      <section id="how" aria-labelledby="how-title" className="mt-12 scroll-mt-6">
        <h2 id="how-title" className="text-lg font-semibold">
          {t("home.example.title")}
        </h2>
        <div className="mt-3 grid gap-6 sm:grid-cols-[1fr_15rem] sm:items-start">
          <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>{t("home.example.1")}</p>
            <p>{t("home.example.2")}</p>
            <p>{t("home.example.3")}</p>
          </div>
          <ExampleCard />
        </div>
      </section>

      {/* Filtres : recherche + statut */}
      <section id="hunts" className="mt-12 scroll-mt-6">
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
          <Select value={countryFilter} onValueChange={setCountryFilter}>
            <SelectTrigger className="w-full sm:w-48" aria-label={t("home.country")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("home.country.all")}</SelectItem>
              {countries.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <h2 className="mt-6 text-lg font-semibold">
          {t(search.trim() ? "home.section.results" : SECTION_TITLE[statusFilter])}
        </h2>
        {hunts === null ? (
          <p className="mt-3 text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : hasNoResults ? (
          loadError || filtering ? (
            <p
              className="mt-3 text-sm text-muted-foreground"
              role={loadError ? "alert" : undefined}
            >
              {loadError ? t("home.loadError") : t("home.noMatch")}
            </p>
          ) : (
            <EmptyState title={t("home.empty")} action={t("home.create")} />
          )
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {hunts.map(({ hunt: h, status, commitCount }) => (
              <li key={h.id}>
                <HuntCard hunt={h} status={status} commitCount={commitCount} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Questions fréquentes */}
      <section aria-labelledby="faq-title" className="mt-14">
        <h2 id="faq-title" className="text-lg font-semibold">
          {t("home.faq.title")}
        </h2>
        <div className="mt-3 divide-y border-y">
          {FAQ.map((q) => (
            <details key={q} className="group py-3">
              <summary className="cursor-pointer list-none text-sm font-medium marker:hidden">
                <span className="mr-2 inline-block text-muted-foreground transition-transform group-open:rotate-90">
                  ›
                </span>
                {t(`${q}.q` as MessageKey)}
              </summary>
              <p className="mt-2 pl-5 text-sm leading-relaxed text-muted-foreground">
                {t(`${q}.a` as MessageKey)}
              </p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}

const FAQ = [
  "home.faq.wallet",
  "home.faq.deposit",
  "home.faq.who",
  "home.faq.after",
  "home.faq.cost",
] as const;

/** Chasse fictive de l'exemple, au format d'une vraie carte. */
function ExampleCard() {
  const { t } = useI18n();
  return (
    <figure
      aria-label={t("home.example.cardLabel")}
      className="rounded-lg border bg-card p-4 text-sm"
    >
      <p className="font-medium">{t("home.example.cardTitle")}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{t("home.example.cardMeta")}</p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div className="h-full w-[70%] rounded-full bg-green-500" />
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">{t("home.example.cardProgress")}</p>
    </figure>
  );
}
