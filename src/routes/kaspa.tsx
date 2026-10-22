import { createFileRoute } from "@tanstack/react-router";

import { useI18n } from "@/lib/i18n";
import { kaspaGuide } from "@/lib/kaspa-guide-content";

export const Route = createFileRoute("/kaspa")({
  head: () => ({
    meta: [
      { title: "Débuter avec Kaspa — Huntited" },
      {
        name: "description",
        content: "Kaspa en deux mots, comment obtenir des KAS de test, ce que ça coûte.",
      },
    ],
  }),
  component: KaspaGuidePage,
});

/** « Débuter avec Kaspa » : comprendre, s'équiper, connaître les coûts. */
function KaspaGuidePage() {
  const { t, locale } = useI18n();
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{t("kaspa.title")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("kaspa.lead")}</p>
      {kaspaGuide(locale).map((s) => (
        <section key={s.title} className="mt-8 space-y-2 text-sm leading-relaxed">
          <h2 className="text-base font-semibold">{s.title}</h2>
          {s.paragraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
          {s.steps && (
            <ol className="list-decimal space-y-1 pl-5">
              {s.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          )}
          {s.links && (
            <p className="flex flex-wrap gap-x-4 gap-y-1">
              {s.links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium underline underline-offset-2"
                >
                  {l.label} ↗
                </a>
              ))}
            </p>
          )}
        </section>
      ))}
    </div>
  );
}
