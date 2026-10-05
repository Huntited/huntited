import { createFileRoute, Link } from "@tanstack/react-router";
import { BadgesPanel } from "@/components/hunt/BadgesPanel";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/lib/useWallet";
import { getUserHunts } from "@/lib/user-hunts";

export const Route = createFileRoute("/my-hunts")({
  head: () => ({
    meta: [
      { title: "Mes chasses — Huntited" },
      {
        name: "description",
        content: "Retrouve les chasses que tu as créées depuis cet appareil.",
      },
      { property: "og:title", content: "Mes chasses — Huntited" },
      {
        property: "og:description",
        content: "Retrouve les chasses que tu as créées depuis cet appareil.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MyHuntsPage,
});

/**
 * Liste des chasses créées par le wallet connecté.
 * L'historique est stocké localement sur l'appareil (mock) —
 * dans la version réelle, il sera dérivé du registre on-chain.
 */
function MyHuntsPage() {
  const { address, isConnected, isLoading, connectWallet } = useWallet();
  const hunts = address ? getUserHunts(address) : [];

  if (!isConnected || !address) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">Mes chasses</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Connecte ton wallet pour voir les chasses que tu as créées.
        </p>
        <Button className="mt-4" size="sm" onClick={() => connectWallet()} disabled={isLoading}>
          {isLoading ? "Connexion…" : "Connecter le wallet"}
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Mes chasses</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Les chasses créées avec ce wallet, sur cet appareil.
      </p>

      {hunts.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">Tu n'as pas encore créé de chasse.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {hunts.map((hunt) => (
            <li key={hunt.huntId}>
              <Link
                to="/hunt/$id"
                params={{ id: hunt.huntId }}
                className="block rounded-lg border p-4 transition-colors hover:bg-accent"
              >
                <div className="font-medium">{hunt.title}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {hunt.location} · avant le{" "}
                  {new Date(hunt.deadline).toLocaleString("fr-FR", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}{" "}
                  · seuil {hunt.threshold}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6">
        <Button asChild>
          <Link to="/create">Créer une chasse</Link>
        </Button>
      </div>

      <BadgesPanel address={address} />
    </div>
  );
}
