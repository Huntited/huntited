import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { ChatPanel } from "@/components/hunt/ChatPanel";
import { HuntSettlementPanel } from "@/components/hunt/HuntSettlementPanel";
import { HuntStatusBadge } from "@/components/hunt/HuntStatusBadge";
import { CommitModal } from "@/components/hunt/CommitModal";
import { ShareHuntButton } from "@/components/hunt/ShareHuntButton";
import { Button } from "@/components/ui/button";
import Countdown from "@/components/ui/Countdown";
import { Separator } from "@/components/ui/separator";
import {
  canOpenChat,
  canSettle,
  getSettlementOutcome,
  isProgressVisible,
} from "@/lib/hunt-lifecycle";
import { getMyPersonalThreshold, settleHunt } from "@/lib/hunt-repository";
import { COMMIT_REFUND_SHORT } from "@/lib/terms";
import { useCommitment } from "@/lib/useCommitment";
import { useHunt } from "@/lib/useHunt";
import { useWallet } from "@/lib/useWallet";

export const Route = createFileRoute("/hunt/$id")({
  head: () => ({
    meta: [
      { title: "Chasse — Huntited" },
      {
        name: "description",
        content:
          "Détails d'une chasse : lieu, date limite, seuil de participants et dépôt. Engagez-vous en privé : tout le monde ou personne.",
      },
      { property: "og:title", content: "Chasse — Huntited" },
      {
        property: "og:description",
        content:
          "Détails d'une chasse : lieu, date limite, seuil et dépôt. Engagement privé : tout le monde ou personne.",
      },
    ],
  }),
  component: HuntDetailPage,
});

function HuntDetailPage() {
  const { id } = Route.useParams();
  const [commitOpen, setCommitOpen] = useState(false);

  // État de la chasse via hunt-repository (mock local ou registre partagé,
  // lecture on-chain Kaspa demain).
  const {
    hunt,
    commitCount,
    status,
    outcome,
    retainedCount,
    retainedThreshold,
    commitsOpen,
    isLoading,
    error,
    refresh,
  } = useHunt(id);
  // Wallet + engagement (un seul engagement par wallet et par chasse).
  const wallet = useWallet();
  const commitment = useCommitment(id, commitsOpen);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10 text-sm text-muted-foreground">Chargement…</div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        <Link to="/" className="text-sm text-muted-foreground hover:underline">
          ← Retour
        </Link>
        <p className="mt-4 text-sm text-muted-foreground" role="alert">
          {error}
        </p>
      </div>
    );
  }

  // Chasse inconnue : état explicite plutôt que fallback silencieux.
  if (!hunt) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        <Link to="/" className="text-sm text-muted-foreground hover:underline">
          ← Retour
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Chasse introuvable</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          La chasse que tu cherches n'existe pas ou a été supprimée.
        </p>
      </div>
    );
  }

  const isExpired = status === "expired";
  const isActivated = status === "activated";

  const deadlineFr = new Date(hunt.deadline).toLocaleString("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
  });

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <Link to="/" className="text-sm text-muted-foreground hover:underline">
        ← Retour
      </Link>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight">{hunt.title}</h1>

      <div className="mt-2 flex items-center justify-between gap-3">
        <HuntStatusBadge status={status} />
        <ShareHuntButton hunt={hunt} />
      </div>

      {/* Infos de la chasse */}
      <div className="mt-6 space-y-3 rounded-lg border p-5 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Lieu</span>
          <span className="text-right font-medium">{hunt.location}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Date limite</span>
          <span className="text-right font-medium">
            {deadlineFr}{" "}
            <span className="text-muted-foreground">
              (<Countdown targetDate={hunt.deadline} onExpire={refresh} />)
            </span>
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Seuil</span>
          <span className="font-medium">{hunt.threshold} participants</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Prix de l'engagement</span>
          <span className="font-medium">{hunt.commitDeposit} KAS</span>
        </div>
      </div>

      <p className="mt-6 text-sm leading-relaxed">{hunt.description}</p>

      {/* Chat Matrix : n'existe qu'après l'activation (jamais avant). */}
      <div className="mt-6">
        {canOpenChat(status, outcome) ? (
          <ChatPanel hunt={hunt} status={status} outcome={outcome} />
        ) : (
          <section className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
            <h2 className="mb-1 font-semibold text-foreground">Chat de coordination</h2>
            {isExpired || (status === "settled" && outcome === "failure")
              ? "Cette hunt a expiré avant d'atteindre son seuil ; aucun chat n'a été ouvert."
              : "Le chat Matrix s'ouvrira si le seuil est atteint."}
          </section>
        )}
      </div>

      {/* Résolution économique (mock, aucun transfert) */}
      <div className="mt-6">
        <HuntSettlementPanel
          hunt={hunt}
          commitCount={commitCount}
          retainedCount={retainedCount ?? commitCount}
          status={status}
          outcome={outcome}
          {...(import.meta.env.DEV && canSettle(status)
            ? {
                onSettle: () => {
                  const o = getSettlementOutcome(status);
                  if (o) void settleHunt(hunt.id, o).finally(refresh);
                },
              }
            : {})}
        />
      </div>

      <Separator className="my-8" />

      {/* Compteur fourni par useHunt (mock ZK-lite) */}
      <div className="flex items-center justify-between">
        {isProgressVisible(hunt, status) ? (
          <div>
            <p className="text-sm text-muted-foreground">Participants engagés</p>
            <p className="text-3xl font-semibold">
              {commitCount}
              <span className="text-base font-normal text-muted-foreground">
                {" "}
                sur {hunt.threshold} requis
              </span>
            </p>
            {retainedCount !== null && retainedCount !== commitCount && (
              <p className="text-sm text-muted-foreground">
                Groupe retenu : {retainedCount} (les autres attendent que leur propre condition soit
                remplie)
              </p>
            )}
          </div>
        ) : (
          <div>
            <p className="text-sm text-muted-foreground">Progression masquée</p>
            <p className="text-sm">
              Seuil : {hunt.threshold} participants. Le nombre d'engagés sera révélé à l'activation
              ou à la date limite.
            </p>
          </div>
        )}
        {/* Engagements ouverts jusqu'à la date limite, même après l'activation */}
        {!commitsOpen ? (
          <Button size="lg" disabled>
            Engagements fermés
          </Button>
        ) : !wallet.isConnected ? (
          <Button size="lg" onClick={() => wallet.connectWallet()} disabled={wallet.isLoading}>
            {wallet.isLoading ? "Connexion…" : "Connecter le wallet"}
          </Button>
        ) : commitment.isCommitted ? (
          <Button size="lg" variant="secondary" disabled>
            Déjà engagé·e
          </Button>
        ) : (
          <Button size="lg" onClick={() => setCommitOpen(true)}>
            S'engager — {hunt.commitDeposit} KAS
          </Button>
        )}
      </div>
      {commitsOpen && !commitment.isCommitted && (
        <p className="mt-2 text-right text-sm font-medium text-green-700">{COMMIT_REFUND_SHORT}</p>
      )}

      {/* Condition personnelle (visible seulement par l'engagé·e concerné·e) */}
      {commitment.isCommitted &&
        wallet.address &&
        (() => {
          const mine = getMyPersonalThreshold(hunt, wallet.address);
          if (mine === undefined) return null;
          const met = retainedThreshold !== null && mine <= retainedThreshold;
          return (
            <p className="mt-3 text-sm" role="status">
              Ta condition : au moins {mine} personnes —{" "}
              {met ? (
                <span className="font-medium text-green-700">
                  remplie, tu fais partie du groupe.
                </span>
              ) : (
                <span className="text-muted-foreground">
                  en attente. Si elle n'est pas remplie, tes {hunt.commitDeposit} KAS te sont
                  rendus.
                </span>
              )}
            </p>
          );
        })()}

      {/* Bannières d'état */}
      {isActivated && (
        <div className="mt-6 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          Cette chasse a atteint son seuil ({retainedCount ?? commitCount} / {hunt.threshold}) :
          l'action aura lieu.
          {commitsOpen &&
            " Les engagements restent ouverts jusqu'à la date limite : le groupe peut encore grandir."}
        </div>
      )}
      {isExpired && !isActivated && (
        <div className="mt-6 rounded-md border bg-muted p-3 text-sm text-muted-foreground">
          Cette chasse est expirée sans avoir atteint son seuil ({commitCount} / {hunt.threshold}).
        </div>
      )}

      {/* Modal de confirmation d'engagement */}
      <CommitModal
        hunt={hunt}
        open={commitOpen}
        onOpenChange={setCommitOpen}
        commitment={commitment}
        walletAddress={wallet.address}
        onConnectWallet={() => void wallet.connectWallet()}
        walletLoading={wallet.isLoading}
        onCommitted={() => {
          // Le compteur se rafraîchit via onCommitmentsChange ; on ferme la modal.
          setCommitOpen(false);
          refresh();
        }}
      />
    </div>
  );
}
