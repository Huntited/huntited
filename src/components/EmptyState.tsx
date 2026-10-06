import { Link } from "@tanstack/react-router";

import { LogoMark } from "@/components/Logo";
import { Button } from "@/components/ui/button";

/** État vide : un message et, au besoin, l'action qui permet d'en sortir. */
export function EmptyState({
  title,
  text,
  action,
  to = "/create",
}: {
  title: string;
  text?: string;
  action?: string;
  to?: "/" | "/create" | "/pass";
}) {
  return (
    <div className="mt-3 flex flex-col items-center rounded-lg border border-dashed px-4 py-10 text-center">
      <LogoMark className="h-10 w-10 opacity-80" />
      <p className="mt-4 font-medium">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>}
      {action && (
        <Button asChild className="mt-4" size="sm">
          <Link to={to}>{action}</Link>
        </Button>
      )}
    </div>
  );
}
