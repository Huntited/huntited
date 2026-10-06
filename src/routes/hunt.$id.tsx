import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { ChatPanel } from "@/components/hunt/ChatPanel";
import { HuntSettlementPanel } from "@/components/hunt/HuntSettlementPanel";
import { HuntStatusBadge } from "@/components/hunt/HuntStatusBadge";
import { CommitModal } from "@/components/hunt/CommitModal";
import { NotifyButton } from "@/components/hunt/NotifyButton";
import { ReplyOnXButton } from "@/components/hunt/ReplyOnXButton";
import { ShareHuntButton } from "@/components/hunt/ShareHuntButton";
import { Button } from "@/components/ui/button";
import Countdown from "@/components/ui/Countdown";
import {
  canOpenChat,
  canSettle,
  getSettlementOutcome,
  isProgressVisible,
} from "@/lib/hunt-lifecycle";
import { countryName } from "@/lib/countries";
import { fetchHuntPreview, huntPreviewMeta } from "@/lib/hunt-preview";
import { getMyPersonalThreshold, settleHunt } from "@/lib/hunt-repository";
import { useI18n } from "@/lib/i18n";
import { commitRefundShort } from "@/lib/terms";
import { useCommitment } from "@/lib/useCommitment";
import { useHunt } from "@/lib/useHunt";
import { getUserHunts } from "@/lib/user-hunts";
import { useWallet } from "@/lib/useWallet";

export const Route = createFileRoute("/hunt/$id")({
  // Aperçu riche du lien (rendu serveur) : informations publiques uniquement.
  loader: ({ params }) => fetchHuntPreview(params.id),
  head: ({ loaderData, params }) => ({
    meta: huntPreviewMeta(loaderData ?? null, params.id),
  }),
  component: HuntDetailPage,
});

function HuntDetailPage() {
  const { id } = Route.useParams();
  const { t, date, locale } = useI18n();
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
      <div className="mx-auto max-w-xl px-4 py-10 text-sm text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  if (error || !hunt) {
    // Chasse inconnue ou registre indisponible : état explicite.
    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        <Link to="/" className="text-sm text-muted-foreground hover:underline">
          {t("common.back")}
        </Link>
        {error ? (
          <p className="mt-4 text-sm text-muted-foreground" role="alert">
            {t("hunt.loadError")}
          </p>
        ) : (
          <>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight">
              {t("hunt.notFound.title")}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{t("hunt.notFound.text")}</p>
          </>
        )}
      </div>
    );
  }

  const isExpired = status === "expired";
  const isActivated = status === "activated";
  // Créateur : chasse créée avec ce wallet (mémoire de l'appareil, ou synchronisée).
  const isCreator =
    wallet.address !== null && getUserHunts(wallet.address).some((h) => h.huntId === hunt.id);

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <Link to="/" className="text-sm text-muted-foreground hover:underline">
        {t("common.back")}
      </Link>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight">{hunt.title}</h1>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <HuntStatusBadge status={status} />
        {/* Pour le créateur, ces boutons sont dans son encadré (plus bas). */}
        {!(isCreator && commitsOpen) && (
          <div className="flex flex-wrap justify-end gap-2">
            <ReplyOnXButton hunt={hunt} />
            <ShareHuntButton hunt={hunt} />
          </div>
        )}
      </div>

      {/* Infos de la chasse */}
      <dl className="mt-6 space-y-3 rounded-lg border p-5 text-sm">
        <Info label={t("hunt.location")}>{hunt.location}</Info>
        {hunt.country && <Info label={t("hunt.country")}>{countryName(hunt.country, locale)}</Info>}
        <Info label={t("hunt.deadline")}>
          {date(hunt.deadline, { dateStyle: "long", timeStyle: "short" })}{" "}
          <span className="text-muted-foreground">
            (<Countdown targetDate={hunt.deadline} onExpire={refresh} />)
          </span>
        </Info>
        <Info label={t("hunt.threshold")}>
          {t("hunt.thresholdValue", { count: hunt.threshold })}
        </Info>
        <Info label={t("hunt.commitDeposit")}>{hunt.commitDeposit} KAS</Info>
        <Info label={t("hunt.caution")}>{hunt.deposit} KAS</Info>
      </dl>

      <p className="mt-6 whitespace-pre-line text-sm leading-relaxed">{hunt.description}</p>

      {/* Progression et engagement : l'action principale de la page */}
      <section className="mt-8 rounded-lg border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {isProgressVisible(hunt, status) ? (
            <div>
              <p className="text-sm text-muted-foreground">{t("hunt.progress.label")}</p>
              <p className="text-3xl font-semibold">
                {commitCount}
                <span className="text-base font-normal text-muted-foreground">
                  {" "}
                  {t("hunt.progress.of", { threshold: hunt.threshold })}
                </span>
              </p>
              <ProgressBar value={retainedCount ?? commitCount} max={hunt.threshold} />
              {retainedCount !== null && retainedCount !== commitCount && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("hunt.progress.retained", { count: retainedCount })}
                </p>
              )}
            </div>
          ) : (
            <div className="max-w-xs">
              <p className="text-sm text-muted-foreground">{t("hunt.progress.hidden")}</p>
              <p className="text-sm">
                {t("hunt.progress.hiddenText", { threshold: hunt.threshold })}
              </p>
            </div>
          )}
          {/* Engagements ouverts jusqu'à la date limite, même après l'activation */}
          {!commitsOpen ? (
            <Button size="lg" disabled>
              {t("hunt.cta.closed")}
            </Button>
          ) : !wallet.isConnected ? (
            <Button size="lg" onClick={() => wallet.connectWallet()} disabled={wallet.isLoading}>
              {wallet.isLoading ? t("wallet.connecting") : t("wallet.connect")}
            </Button>
          ) : commitment.isCommitted ? (
            <Button size="lg" variant="secondary" disabled>
              {t("hunt.cta.committed")}
            </Button>
          ) : (
            <Button size="lg" onClick={() => setCommitOpen(true)}>
              {t("hunt.cta.commit", { amount: hunt.commitDeposit })}
            </Button>
          )}
        </div>
        {commitsOpen && !commitment.isCommitted && (
          <p className="mt-3 text-sm font-medium text-green-700 dark:text-green-400">
            {commitRefundShort(hunt.deposit, locale)}
          </p>
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
                {t("hunt.condition", { count: mine })}{" "}
                {met ? (
                  <span className="font-medium text-green-700 dark:text-green-400">
                    {t("hunt.condition.met")}
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    {t("hunt.condition.pending", { amount: hunt.commitDeposit })}
                  </span>
                )}
              </p>
            );
          })()}

        {/* Être prévenu·e du résultat, sans compte ni wallet */}
        {status === "active" && <NotifyButton huntId={hunt.id} />}
      </section>

      {/* Encadré du créateur : mobiliser pendant que la chasse est ouverte */}
      {isCreator && commitsOpen && (
        <section
          aria-labelledby="creator-box"
          className="mt-4 rounded-lg border border-l-4 border-l-green-500 bg-card p-5"
        >
          <h2 id="creator-box" className="font-semibold">
            {t("creator.title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("creator.text")}</p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>{t("creator.tip1")}</li>
            <li>{t("creator.tip2")}</li>
            <li>{t("creator.tip3")}</li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <ShareHuntButton hunt={hunt} />
            <ReplyOnXButton hunt={hunt} />
          </div>
        </section>
      )}

      {/* Bannières d'état */}
      {isActivated && (
        <div className="mt-4 rounded-md border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950 p-3 text-sm text-green-700 dark:text-green-400">
          {t("hunt.banner.activated", {
            count: retainedCount ?? commitCount,
            threshold: hunt.threshold,
          })}
          {commitsOpen && ` ${t("hunt.banner.stillOpen")}`}
        </div>
      )}
      {isExpired && !isActivated && (
        <div className="mt-4 rounded-md border bg-muted p-3 text-sm text-muted-foreground">
          {t("hunt.banner.expired", { count: commitCount, threshold: hunt.threshold })}
        </div>
      )}

      {/* Chat Matrix : n'existe qu'après l'activation (jamais avant). */}
      <div className="mt-6">
        {canOpenChat(status, outcome) ? (
          <ChatPanel hunt={hunt} status={status} outcome={outcome} />
        ) : (
          <section className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
            <h2 className="mb-1 font-semibold text-foreground">{t("hunt.chat.title")}</h2>
            {isExpired || (status === "settled" && outcome === "failure")
              ? t("hunt.chat.expired")
              : t("hunt.chat.later")}
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

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}

/** Barre de progression vers le seuil (visuelle ; le nombre reste écrit à côté). */
function ProgressBar({ value, max }: { value: number; max: number }) {
  const percent = Math.min(100, Math.round((value / Math.max(1, max)) * 100));
  return (
    <div
      className="mt-2 h-2 w-48 max-w-full overflow-hidden rounded-full bg-muted"
      aria-hidden="true"
    >
      <div
        className="h-full rounded-full bg-green-500 transition-[width] duration-500 motion-reduce:transition-none"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
