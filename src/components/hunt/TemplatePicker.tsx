// Exemples de chasse (haut du formulaire de création) : une ligne discrète
// de pastilles ; l'exemple choisi remplit le formulaire.
import { useState } from "react";

import { FEATURED_TEMPLATES, HUNT_TEMPLATES, templateText } from "@/lib/hunt-templates";
import { useI18n } from "@/lib/i18n";

export function TemplatePicker({
  selected,
  onPick,
  onUndo,
}: {
  selected: string | null;
  onPick: (id: string) => void;
  onUndo: () => void;
}) {
  const { t, locale } = useI18n();
  // Six idées d'abord ; les autres sur demande (ou si l'une d'elles est choisie).
  const [all, setAll] = useState(false);
  const showAll = all || (selected !== null && !FEATURED_TEMPLATES.includes(selected));
  const list = showAll
    ? HUNT_TEMPLATES
    : HUNT_TEMPLATES.filter((x) => FEATURED_TEMPLATES.includes(x.id));
  return (
    <div className="space-y-2">
      <p id="tpl-title" className="text-sm text-muted-foreground">
        {t("tpl.title")}
      </p>
      <ul aria-labelledby="tpl-title" className="flex flex-wrap gap-1.5">
        {list.map((tpl) => (
          <li key={tpl.id}>
            <button
              type="button"
              onClick={() => onPick(tpl.id)}
              aria-pressed={selected === tpl.id}
              className="rounded-full border px-3 py-1 text-sm transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
            >
              {templateText(tpl.id, locale).name}
            </button>
          </li>
        ))}
        {!showAll && (
          <li>
            <button
              type="button"
              onClick={() => setAll(true)}
              className="rounded-full px-3 py-1 text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              {t("tpl.more")}
            </button>
          </li>
        )}
      </ul>
      {selected && (
        <p role="status" className="text-sm text-muted-foreground">
          {t("tpl.applied", { name: templateText(selected, locale).name })}{" "}
          <button
            type="button"
            onClick={onUndo}
            className="font-medium text-foreground underline underline-offset-2 hover:no-underline"
          >
            {t("tpl.undo")}
          </button>
        </p>
      )}
    </div>
  );
}
