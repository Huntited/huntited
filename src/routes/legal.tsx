import { createFileRoute } from "@tanstack/react-router";

import { useI18n } from "@/lib/i18n";
import { LEGAL_UPDATED, legalSections } from "@/lib/legal-content";

export const Route = createFileRoute("/legal")({
  head: () => ({
    meta: [
      { title: "Conditions, vie privée et charte — Huntited" },
      {
        name: "description",
        content: "Conditions d'utilisation, politique de vie privée et charte de Huntited.",
      },
    ],
  }),
  component: LegalPage,
});

/** Conditions d'utilisation, vie privée (RGPD) et charte, avec sommaire. */
function LegalPage() {
  const { t, locale, date } = useI18n();
  const sections = legalSections(locale);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{t("legal.title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("legal.updated", { date: date(LEGAL_UPDATED, { dateStyle: "long" }) })}
      </p>
      <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
        {t("legal.draft")}
      </p>

      <nav aria-label={t("legal.toc")} className="mt-6">
        <ul className="flex flex-wrap gap-2 text-sm">
          {sections.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="block rounded-md border px-3 py-1.5 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {s.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {sections.map((s) => (
        <section
          key={s.id}
          id={s.id}
          aria-labelledby={`${s.id}-title`}
          className="mt-10 scroll-mt-6"
        >
          <h2 id={`${s.id}-title`} className="text-xl font-semibold">
            {s.title}
          </h2>
          {s.blocks.map((b, i) => (
            <div key={i} className="mt-4">
              {b.heading && <h3 className="font-medium">{b.heading}</h3>}
              {b.paragraphs.map((p, j) => (
                <p key={j} className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {p}
                </p>
              ))}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
