/** Logo Huntited : une cible (le point vert = le groupe qui se déclenche). */
export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#111827" />
      <circle cx="32" cy="32" r="18" fill="none" stroke="#fff" strokeWidth="5" />
      <circle cx="32" cy="32" r="7" fill="#22c55e" />
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
