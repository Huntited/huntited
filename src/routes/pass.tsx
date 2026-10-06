import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createInvitation,
  exportPass,
  forgetPass,
  getPassConfig,
  hasPass,
  importPass,
  joinWithInvitation,
  onPassChange,
  remainingInvites,
  type PassConfig,
} from "@/lib/pass";

export const Route = createFileRoute("/pass")({
  head: () => ({
    meta: [
      { title: "Mon pass — Huntited" },
      {
        name: "description",
        content: "Ton pass Huntited : une personne, un engagement, sans donnée personnelle.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PassPage,
});

/** Accepte un code seul ou un lien d'invitation complet (…/pass#code). */
const invitationFrom = (text: string) => text.trim().split("#").pop() ?? "";

function PassPage() {
  const [config, setConfig] = useState<PassConfig | null>(null);
  const [mine, setMine] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getPassConfig().then(setConfig);
    setMine(hasPass());
    // Invitation reçue par lien : le code est après « # » (jamais envoyé au
    // serveur de la page). On l'efface de la barre d'adresse et de l'historique.
    const fromLink = window.location.hash.slice(1);
    if (fromLink) {
      setCode(fromLink);
      window.history.replaceState(null, "", window.location.pathname);
    }
    return onPassChange(() => setMine(hasPass()));
  }, []);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "L'opération a échoué. Réessaie.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <Link to="/" className="text-sm text-muted-foreground hover:underline">
        ← Retour
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Mon pass</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Le pass prouve que tu es une vraie personne : une personne = un engagement par chasse. Il
        reste sur cet appareil ; Huntited ne sait jamais qui tu es ni à quelles chasses tu
        participes.
      </p>

      {config === null ? (
        <p className="mt-6 text-sm text-muted-foreground">Chargement…</p>
      ) : !config.available ? (
        <p className="mt-6 rounded-lg border p-4 text-sm text-muted-foreground">
          Les pass fonctionnent avec le registre partagé : ils ne sont pas disponibles dans ce mode
          de démonstration.
        </p>
      ) : mine ? (
        <ActivePass config={config} busy={busy} run={run} />
      ) : (
        <section className="mt-6 space-y-3 rounded-lg border p-4">
          <h2 className="font-semibold">Rejoindre avec une invitation</h2>
          <p className="text-sm text-muted-foreground">
            Un membre te l'envoie (par exemple sur Signal). Chaque invitation ne sert qu'une fois.
          </p>
          <label htmlFor="invitation" className="text-sm font-medium">
            Code ou lien d'invitation
          </label>
          <Input
            id="invitation"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="off"
          />
          <Button
            className="w-full"
            disabled={busy || !invitationFrom(code)}
            onClick={() =>
              void run(async () => {
                await joinWithInvitation(invitationFrom(code));
                setCode("");
                toast.success("Ton pass est créé.");
              })
            }
          >
            {busy ? "Création…" : "Créer mon pass"}
          </Button>
          <RestorePass busy={busy} run={run} />
        </section>
      )}

      {error && (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function ActivePass({
  config,
  busy,
  run,
}: {
  config: PassConfig;
  busy: boolean;
  run: (action: () => Promise<void>) => Promise<void>;
}) {
  const [link, setLink] = useState<string | null>(null);
  const [left, setLeft] = useState(() => remainingInvites(config.invitesPerMonth));

  return (
    <div className="mt-6 space-y-4">
      <p className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-700">
        Ton pass est actif sur cet appareil.
      </p>

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-semibold">Inviter quelqu'un</h2>
        <p className="text-sm text-muted-foreground">
          Invite seulement des personnes que tu connais : chaque invitation crée un pass. Il te
          reste {left} invitation{left > 1 ? "s" : ""} ce mois-ci.
        </p>
        {link ? (
          <div className="space-y-2">
            <Input readOnly value={link} aria-label="Lien d'invitation" />
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                void navigator.clipboard
                  .writeText(link)
                  .then(() => toast.success("Lien copié."))
                  .catch(() => toast.error("Copie impossible : sélectionne le lien."))
              }
            >
              Copier le lien
            </Button>
            <p className="text-xs text-muted-foreground">
              Envoie-le par une messagerie chiffrée (Signal). Valable 7 jours, pour une seule
              personne.
            </p>
          </div>
        ) : (
          <Button
            disabled={busy || left === 0}
            onClick={() =>
              void run(async () => {
                setLink(await createInvitation(config.invitesPerMonth));
                setLeft(remainingInvites(config.invitesPerMonth));
              })
            }
          >
            {busy ? "Preuve en cours…" : "Créer une invitation"}
          </Button>
        )}
      </section>

      <details className="rounded-lg border p-4 text-sm">
        <summary className="cursor-pointer font-semibold">Sauvegarder ou retirer mon pass</summary>
        <div className="mt-3 space-y-3">
          <p className="text-muted-foreground">
            Sans sauvegarde, ton pass est perdu si tu changes de téléphone ou effaces les données du
            site. Garde ce code pour toi : qui l'a peut s'engager à ta place.
          </p>
          <Textarea readOnly value={exportPass() ?? ""} rows={2} aria-label="Code de sauvegarde" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (
                window.confirm("Retirer le pass de cet appareil ? Sans sauvegarde, il est perdu.")
              )
                forgetPass();
            }}
          >
            Retirer le pass de cet appareil
          </Button>
        </div>
      </details>
    </div>
  );
}

function RestorePass({
  busy,
  run,
}: {
  busy: boolean;
  run: (action: () => Promise<void>) => Promise<void>;
}) {
  const [secret, setSecret] = useState("");
  return (
    <details className="pt-2 text-sm">
      <summary className="cursor-pointer text-muted-foreground">
        J'ai déjà un pass (restaurer une sauvegarde)
      </summary>
      <div className="mt-2 space-y-2">
        <Textarea
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          rows={2}
          aria-label="Code de sauvegarde à restaurer"
        />
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !secret.trim()}
          onClick={() =>
            void run(async () => {
              await importPass(secret);
              toast.success("Pass restauré.");
            })
          }
        >
          Restaurer
        </Button>
      </div>
    </details>
  );
}
