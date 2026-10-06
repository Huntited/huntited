import * as React from "react";

import { cn } from "@/lib/utils";

/** Types de champ qui affichent une coche une fois remplis (pas de contrôle natif à droite). */
const CHECK_TYPES = new Set([undefined, "text", "email", "url", "tel"]);
/** Types sans état vide / rempli (la recherche n'est pas un champ « à remplir »). */
const NO_STATE_TYPES = new Set([
  "checkbox",
  "radio",
  "file",
  "hidden",
  "submit",
  "button",
  "search",
]);

/**
 * État de remplissage d'un champ contrôlé (styles .hf-field dans styles.css) :
 * « false » vide, « true » rempli ; absent pour un champ non contrôlé,
 * en lecture seule ou désactivé.
 */
export function filledState(props: {
  value?: unknown;
  readOnly?: boolean | undefined;
  disabled?: boolean | undefined;
}): "true" | "false" | undefined {
  if (props.value === undefined || props.readOnly || props.disabled) return undefined;
  return String(props.value).trim() === "" ? "false" : "true";
}

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    const filled = NO_STATE_TYPES.has(type ?? "") ? undefined : filledState(props);
    return (
      <input
        type={type}
        data-filled={filled}
        data-check={filled && CHECK_TYPES.has(type) ? "" : undefined}
        className={cn(
          "hf-field flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
