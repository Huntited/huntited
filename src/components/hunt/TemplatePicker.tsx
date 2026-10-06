// Choix d'un modèle de chasse (haut du formulaire de création).
import { HUNT_TEMPLATES, templateText, type HuntTemplate } from "@/lib/hunt-templates";
import { useI18n } from "@/lib/i18n";

export function TemplatePicker({
  selected,
  onPick,
}: {
  selected: string | null;
  onPick: (template: HuntTemplate) => void;
}) {
  const { t, locale } = useI18n();
  return (
    <section aria-labelledby="tpl-title" className="space-y-3">
      <div>
        <h2 id="tpl-title" className="text-base font-semibold">
          {t("tpl.title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("tpl.lead")}</p>
      </div>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {HUNT_TEMPLATES.map((tpl) => (
          <li key={tpl.id}>
            <button
              type="button"
              onClick={() => onPick(tpl)}
              aria-pressed={selected === tpl.id}
              className="flex h-full w-full items-center gap-2 rounded-md border bg-card px-3 py-2 text-left text-sm transition-colors hover:border-green-500 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-green-500 aria-pressed:bg-green-50 dark:aria-pressed:bg-green-950"
            >
              <span aria-hidden="true" className="text-lg">
                {tpl.emoji}
              </span>
              <span>{templateText(tpl.id, locale).name}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
