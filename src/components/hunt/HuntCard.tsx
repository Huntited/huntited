import { Link } from "@tanstack/react-router";
import { Clock, MapPin } from "lucide-react";

import { HuntStatusBadge } from "@/components/hunt/HuntStatusBadge";
import { isProgressVisible } from "@/lib/hunt-lifecycle";
import { useI18n } from "@/lib/i18n";
import { placeLabel } from "@/lib/online";
import type { Hunt, HuntStatus } from "@/lib/types";

/** Barre de progression vers le seuil (décorative : le nombre est écrit à côté). */
export function ThresholdBar({ value, max }: { value: number; max: number }) {
  const percent = Math.min(100, Math.round((value / Math.max(1, max)) * 100));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

/**
 * Carte d'une action dans une liste : le nombre de personnes nécessaires en
 * gros, puis le titre, la ville et le temps restant (ou l'état si c'est fini).
 */
export function HuntCard({
  hunt,
  status,
  commitCount,
}: {
  hunt: Pick<Hunt, "id" | "title" | "location" | "deadline" | "threshold"> &
    Partial<Pick<Hunt, "progressVisibility" | "country">>;
  status: HuntStatus;
  /** null : compteur masqué. */
  commitCount: number | null;
}) {
  const { t, relative } = useI18n();
  const ended = Date.parse(hunt.deadline) <= Date.now();
  const open = status === "active" && !ended;
  const visible = isProgressVisible(hunt, status) && commitCount !== null;
  // La ville suffit dans une liste (le détail est sur la page de l'action).
  const place = placeLabel(hunt, t).split(",")[0];

  return (
    <Link
      to="/hunt/$id"
      params={{ id: hunt.id }}
      className="flex items-center gap-4 rounded-2xl border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="w-14 shrink-0 text-center">
        <p className="text-2xl font-semibold leading-none text-highlight">{hunt.threshold}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t("card.people")}</p>
      </div>
      <div className="min-w-0 flex-1 border-l pl-4">
        <p className="font-medium leading-snug">{hunt.title}</p>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{place}</span>
        </p>
        {open ? (
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-primary">
            <Clock className="size-3.5 shrink-0" aria-hidden />
            {t("card.endsIn", { when: relative(hunt.deadline) })}
          </p>
        ) : (
          <div className="mt-1.5">
            <HuntStatusBadge status={status} />
          </div>
        )}
        {visible && (
          <div className="mt-2 space-y-1">
            <ThresholdBar value={commitCount} max={hunt.threshold} />
            <p className="text-xs text-muted-foreground">
              {t("home.card.progress", { count: commitCount, threshold: hunt.threshold })}
            </p>
          </div>
        )}
      </div>
    </Link>
  );
}
