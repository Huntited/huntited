import { createFileRoute } from "@tanstack/react-router";

import { CreateHuntForm } from "@/components/hunt/CreateHuntForm";

export const Route = createFileRoute("/create")({
  head: () => ({
    meta: [
      { title: "Créer une chasse — Huntited" },
      {
        name: "description",
        content:
          "Créez une action collective coordonnée : dépôt de création de 30 KAS, engagements à 5 KAS et déclenchement atomique.",
      },
      { property: "og:title", content: "Créer une chasse — Huntited" },
      {
        property: "og:description",
        content:
          "Créez une action collective coordonnée : seuil, dépôt, déclenchement atomique et engagements anonymes.",
      },
    ],
  }),
  component: CreateHuntPage,
});

function CreateHuntPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Créer une chasse</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Définissez l'action collective et le seuil de participants. Aucun organisateur central : la
        chasse se déclenche d'elle-même quand le seuil est atteint.
      </p>

      <div className="mt-8">
        <CreateHuntForm />
      </div>
    </div>
  );
}
