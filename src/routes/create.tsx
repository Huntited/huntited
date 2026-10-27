import { createFileRoute } from "@tanstack/react-router";

import { CreateHuntForm } from "@/components/hunt/CreateHuntForm";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/create")({
  head: () => ({
    meta: [
      { title: "Créer une action — Huntited" },
      {
        name: "description",
        content:
          "Créez une action collective coordonnée : caution de 30 KAS, engagements rendus à la fin, tout le monde ou personne.",
      },
      { property: "og:title", content: "Créer une action — Huntited" },
      {
        property: "og:description",
        content:
          "Créez une action collective coordonnée : un seuil, une caution, et l'action n'a lieu que si assez de monde s'engage.",
      },
    ],
  }),
  component: CreateHuntPage,
});

function CreateHuntPage() {
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{t("create.title")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("create.lead")}</p>

      <div className="mt-8">
        <CreateHuntForm />
      </div>
    </div>
  );
}
