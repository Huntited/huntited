import type { HuntStatus } from "@/lib/types";

/** Libellés français et couleurs de chaque état (demandés par le produit). */
const STATUS_STYLES: Record<HuntStatus, { label: string; className: string }> = {
  draft: {
    label: "Brouillon",
    className: "bg-yellow-100 text-yellow-900 border-yellow-300 dark:bg-yellow-950 dark:text-yellow-200 dark:border-yellow-800",
  },
  active: {
    label: "En cours",
    className: "bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800",
  },
  activated: {
    label: "Seuil atteint",
    className: "bg-green-100 text-green-900 border-green-300 dark:bg-green-950 dark:text-green-200 dark:border-green-800",
  },
  expired: {
    label: "Expirée",
    className: "bg-muted text-muted-foreground border-border",
  },
  settled: {
    label: "Résolue",
    className: "bg-violet-100 text-violet-900 border-violet-300 dark:bg-violet-950 dark:text-violet-200 dark:border-violet-800",
  },
};

/** Badge d'état accessible : texte explicite, pas seulement une couleur. */
export function HuntStatusBadge({ status }: { status: HuntStatus }) {
  const { label, className } = STATUS_STYLES[status];
  return (
    <span
      role="status"
      aria-label={`Statut : ${label}`}
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${className}`}
    >
      {label}
    </span>
  );
}
