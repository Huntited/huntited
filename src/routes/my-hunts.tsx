import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { BadgesPanel } from "@/components/hunt/BadgesPanel";
import { HuntStatusBadge } from "@/components/hunt/HuntStatusBadge";
import { Button } from "@/components/ui/button";
import {
  getDataMode,
  listMyEngagements,
  onHuntsChange,
  syncMyActivity,
  type HuntView,
} from "@/lib/hunt-repository";
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
 * Chasses créées et engagements du wallet connecté, puis ses badges.
 * Mémorisés sur l'appareil ; en mode registre partagé, « Synchroniser »
 * récupère l'activité faite sur d'autres appareils (une signature).
 */
function MyHuntsPage() {
  const { address, isConnected, isLoading, connectWallet } = useWallet();
  const [version, setVersion] = useState(0);
  const [engagements, setEngagements] = useState<HuntView[]>([]);
  const [sync, setSync] = useState<{ busy: boolean; message: string | null }>({
    busy: false,
    message: null,
  });
  const hunts = address ? getUserHunts(address) : [];

  useEffect(() => onHuntsChange(() => setVersion((v) => v + 1)), []);
  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    listMyEngagements(address)
      .then((v) => !cancelled && setEngagements(v))
      .catch(() => !cancelled && setEngagements([]));
    return () => {
      cancelled = true;
    };
  }, [address, version]);

  const handleSync = async () => {
    if (!address) return;
    setSync({ busy: true, message: null });
    try {
      const r = await syncMyActivity(address);
      setSync({
        busy: false,
        message: `Synchronisé : ${r.created} chasse(s) créée(s), ${r.commitments} engagement(s).`,
      });
    } catch (e) {
      setSync({
        busy: false,
        message: e instanceof Error ? e.message : "La synchronisation a échoué.",
      });
    }
  };

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
        Les chasses créées avec ce wallet
        {getDataMode() === "api" ? "." : ", sur cet appareil."}
      </p>

      {getDataMode() === "api" && (
        <div className="mt-4 rounded-lg border p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-muted-foreground">
              Tu as utilisé ce wallet sur un autre appareil ? Récupère tes chasses et tes
              engagements (une signature, aucun KAS).
            </span>
            <Button size="sm" variant="outline" onClick={handleSync} disabled={sync.busy}>
              {sync.busy ? "Synchronisation…" : "Synchroniser"}
            </Button>
          </div>
          {sync.message && (
            <p className="mt-2 text-xs" role="status">
              {sync.message}
            </p>
          )}
        </div>
      )}

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

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Mes engagements</h2>
        {engagements.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Aucun engagement pour l'instant.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {engagements.map(({ hunt, status }) => (
              <li key={hunt.id}>
                <Link
                  to="/hunt/$id"
                  params={{ id: hunt.id }}
                  className="flex items-center justify-between gap-3 rounded-lg border p-4 transition-colors hover:bg-accent"
                >
                  <div>
                    <div className="font-medium">{hunt.title}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{hunt.location}</div>
                  </div>
                  <HuntStatusBadge status={status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <BadgesPanel address={address} />
    </div>
  );
}
