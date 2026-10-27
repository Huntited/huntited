import { useI18n, type MessageKey } from "@/lib/i18n";
import type { HuntStatus } from "@/lib/types";

/** Libellé (traduit) et couleurs de chaque état. */
const STATUS_STYLES: Record<HuntStatus, { label: MessageKey; className: string }> = {
  draft: {
    label: "status.draft",
    className:
      "bg-yellow-100 text-yellow-900 border-yellow-300 dark:bg-yellow-950 dark:text-yellow-200 dark:border-yellow-800",
  },
  active: {
    label: "status.active",
    className: "bg-accent text-accent-foreground border-transparent",
  },
  activated: {
    label: "status.activated",
    className: "bg-primary text-primary-foreground border-transparent",
  },
  expired: {
    label: "status.expired",
    className: "bg-muted text-muted-foreground border-border",
  },
  settled: {
    label: "status.settled",
    className:
      "bg-violet-100 text-violet-900 border-violet-300 dark:bg-violet-950 dark:text-violet-200 dark:border-violet-800",
  },
};

/** Badge d'état accessible : texte explicite, pas seulement une couleur. */
export function HuntStatusBadge({ status }: { status: HuntStatus }) {
  const { t } = useI18n();
  const { className } = STATUS_STYLES[status];
  const label = t(STATUS_STYLES[status].label);
  return (
    <span
      role="status"
      aria-label={t("status.aria", { label })}
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${className}`}
    >
      {label}
    </span>
  );
}
