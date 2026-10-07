import { useEffect, useId, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { findCities, loadCities, searchCities, type CitySuggestion } from "@/lib/cities";
import { countryName } from "@/lib/countries";
import { useI18n } from "@/lib/i18n";

/**
 * Champ « Ville » avec suggestions (liste déroulante accessible : flèches,
 * Entrée, Échap). Choisir une ville remplit aussi le pays. À chaque saisie,
 * `onResolve` reçoit les villes qui correspondent exactement au texte (une
 * par pays, les plus peuplées d'abord), ou null si la liste n'a pas pu être
 * chargée : le formulaire s'en sert pour vérifier la ville et trouver le pays.
 * La recherche se fait sur l'appareil (voir lib/cities.ts).
 */
export function CityInput({
  id,
  value,
  onChange,
  onPick,
  onResolve,
  placeholder,
  invalid,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (text: string) => void;
  onPick: (city: CitySuggestion) => void;
  onResolve?: (matches: CitySuggestion[] | null) => void;
  placeholder: string;
  invalid?: boolean;
  describedBy?: string | undefined;
}) {
  const { t, locale } = useI18n();
  const listId = useId();
  const [items, setItems] = useState<CitySuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const index = useRef<Awaited<ReturnType<typeof loadCities>> | null>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  // Dernière saisie : le fichier des villes peut finir de charger après la frappe.
  const latest = useRef(value);
  latest.current = value;

  // Suggestions recalculées à chaque frappe (index chargé au premier focus).
  const refresh = (text: string) => {
    if (!index.current) return;
    const found = searchCities(index.current, text);
    setItems(found);
    setActive(-1);
    setOpen(found.length > 0);
  };

  const ensureLoaded = () => {
    if (index.current) return;
    void loadCities()
      .then((idx) => {
        index.current = idx;
        if (document.activeElement?.id === id) refresh(latest.current);
        resolve.current?.(findCities(idx, latest.current));
      })
      .catch(() => {
        // Sans liste : pas de vérification possible, le champ reste libre.
        resolve.current?.(null);
      });
  };

  // Chargée dès l'affichage : la ville d'un brouillon est vérifiée aussi.
  const resolve = useRef(onResolve);
  resolve.current = onResolve;
  useEffect(ensureLoaded, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Vérification à chaque changement du texte (saisie ou choix dans la liste).
  useEffect(() => {
    if (index.current) onResolve?.(findCities(index.current, value));
    // onResolve change à chaque rendu du formulaire : seul le texte compte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Ferme la liste quand le focus quitte le champ et la liste.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!wrapper.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const pick = (city: CitySuggestion) => {
    onPick(city);
    setOpen(false);
    setActive(-1);
  };

  const population = (n: number) =>
    new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-GB", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n);

  return (
    <div ref={wrapper} className="relative">
      <Input
        id={id}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onFocus={ensureLoaded}
        onChange={(e) => {
          onChange(e.target.value);
          refresh(e.target.value);
        }}
        onKeyDown={(e) => {
          if (!open || items.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => (a + 1) % items.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (a <= 0 ? items.length - 1 : a - 1));
          } else if (e.key === "Enter" && active >= 0) {
            e.preventDefault();
            pick(items[active]!);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={t("city.suggestions")}
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border bg-popover p-1 text-sm shadow-md"
        >
          {items.map((city, i) => (
            <li
              key={`${city.name}-${city.country}-${city.population}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // mousedown : choisir avant que le champ perde le focus.
              onMouseDown={(e) => {
                e.preventDefault();
                pick(city);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-baseline justify-between gap-3 rounded px-2 py-1.5 ${
                i === active ? "bg-accent text-accent-foreground" : ""
              }`}
            >
              <span>
                <span className="font-medium">{city.name}</span>
                {city.alias && <span className="text-muted-foreground"> ({city.alias})</span>}
                <span className="text-muted-foreground">, {countryName(city.country, locale)}</span>
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {t("city.population", { count: population(city.population) })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
