import { Link } from "@tanstack/react-router";

import { HuntStatusBadge } from "@/components/hunt/HuntStatusBadge";
import { countryName } from "@/lib/countries";
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
        className="h-full rounded-full bg-green-500 transition-[width] duration-500 motion-reduce:transition-none"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

/**
 * Carte d'une chasse dans une liste : titre, statut, lieu, échéance relative
 * et progression (ou « progression masquée »).
 */
export function HuntCard({
  hunt,
  status,
  commitCount,
}: {
  hunt: Pick<Hunt, "id" | "title" | "location" | "deadline" | "threshold"> &
    Partial<Pick<Hunt, "progressVisibility" | "country">>;
  status: HuntStatus;
  /** null : compteur masqué par le serveur. */
  commitCount: number | null;
}) {
  const { t, relative, locale } = useI18n();
  const ended = Date.parse(hunt.deadline) <= Date.now();
  const visible = isProgressVisible(hunt, status) && commitCount !== null;

  return (
    <Link
      to="/hunt/$id"
      params={{ id: hunt.id }}
      className="block rounded-lg border bg-card p-4 transition-colors hover:border-foreground/30 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="font-medium leading-snug">{hunt.title}</span>
        <HuntStatusBadge status={status} />
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {placeLabel(hunt, t)}
        {hunt.country ? `, ${countryName(hunt.country, locale)}` : ""} ·{" "}
        {t(ended ? "card.ended" : "card.endsIn", { when: relative(hunt.deadline) })}
      </p>
      <div className="mt-3 space-y-1.5">
        {visible ? (
          <>
            <ThresholdBar value={commitCount} max={hunt.threshold} />
            <p className="text-xs text-muted-foreground">
              {t("home.card.progress", { count: commitCount, threshold: hunt.threshold })}
            </p>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            {t("home.card.hidden", { threshold: hunt.threshold })}
          </p>
        )}
      </div>
    </Link>
  );
}
