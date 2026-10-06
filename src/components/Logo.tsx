/**
 * Logo Huntited : une cible (anneaux + réticule de visée) ; la mouche verte
 * au centre = le groupe qui se déclenche. Même dessin que public/favicon.svg.
 */
export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#111827" />
      <g fill="none" stroke="#fff" strokeLinecap="round">
        <circle cx="32" cy="32" r="21" strokeWidth="3" />
        <circle cx="32" cy="32" r="13.5" strokeWidth="3" />
        <path d="M32 5v9M32 50v9M5 32h9M50 32h9" strokeWidth="3.5" />
      </g>
      <circle cx="32" cy="32" r="6.5" fill="#22c55e" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2">
      <LogoMark />
      <span className="text-lg font-semibold tracking-tight">Huntited</span>
    </span>
  );
}
