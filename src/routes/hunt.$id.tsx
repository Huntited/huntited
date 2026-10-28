import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarClock, Check, ChevronDown, MapPin } from "lucide-react";
import { useEffect, useState } from "react";

import { P2PChatPanel } from "@/components/hunt/P2PChatPanel";
import { HuntSettlementPanel } from "@/components/hunt/HuntSettlementPanel";
import { HuntStatusBadge } from "@/components/hunt/HuntStatusBadge";
import { AfterNote, WithdrawBox } from "@/components/hunt/CommitExtras";
import { CommitModal } from "@/components/hunt/CommitModal";
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
import { placeLabel } from "@/lib/online";
import { huntPreviewMeta } from "@/lib/hunt-preview";
import { getDataMode, getMyPersonalThreshold, settleHunt } from "@/lib/hunt-repository";
import { getMyCommitment } from "@/lib/my-commitments";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { markRead } from "@/lib/inbox";
import { commitRefundShort } from "@/lib/terms";
import { useCommitment } from "@/lib/useCommitment";
import { useHunt } from "@/lib/useHunt";
import { getUserHunts } from "@/lib/user-hunts";
import { useWallet } from "@/lib/useWallet";

export const Route = createFileRoute("/hunt/$id")({
  // Code de présence d'une mission, lu dans un QR (src/lib/missions.ts).
  validateSearch: (s: Record<string, unknown>): { code?: string } =>
    typeof s["code"] === "string" && /^[A-Za-z0-9]{6}$/.test(s["code"]) ? { code: s["code"] } : {},
  head: ({ params }) => ({ meta: huntPreviewMeta(null, params.id) }),
  component: HuntDetailPage,
});

function HuntDetailPage() {
  const search = Route.useSearch();
  const { id } = Route.useParams();
  // Ouvrir la chasse = voir ses nouveautés (cloche de l'en-tête).
  useEffect(() => markRead({ huntId: id }), [id]);
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
    pending,
    outcomePending,
    hidden,
    refresh,
  } = useHunt(id);
  // Wallet + engagement (un seul engagement par wallet et par chasse).
  const wallet = useWallet();
  const commitment = useCommitment(id, commitsOpen, status === "activated" || status === "settled");

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

  if (hidden) {
    // Modération : la chasse reste sur la blockchain, mais le site ne l'affiche plus.
    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        <Link to="/" className="text-sm text-muted-foreground hover:underline">
          {t("common.back")}
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">{t("hunt.hidden.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("hunt.hidden.text", { reason: t(`hide.reason.${hidden}` as MessageKey) })}
        </p>
        <Link to="/legal" hash="conditions" className="mt-3 inline-block text-sm underline">
          {t("hunt.hidden.rules")}
        </Link>
      </div>
    );
  }

  const isExpired = status === "expired";
  const isActivated = status === "activated";
  // Créateur : chasse créée avec ce wallet (mémoire de l'appareil, ou synchronisée).
  const isCreator =
    wallet.address !== null && getUserHunts(wallet.address).some((h) => h.huntId === hunt.id);

  // Bouton principal : un seul, selon la situation.
  const cta = pending ? (
    <Button size="lg" className="h-11 w-full rounded-xl" disabled>
      {t("hunt.cta.pending")}
    </Button>
  ) : !commitsOpen ? (
    <Button size="lg" className="h-11 w-full rounded-xl" disabled>
      {t("hunt.cta.closed")}
    </Button>
  ) : !wallet.isConnected ? (
    <Button
      size="lg"
      className="h-11 w-full rounded-xl"
      onClick={() => wallet.connectWallet()}
      disabled={wallet.isLoading}
    >
      {wallet.isLoading ? t("wallet.connecting") : t("hunt.cta.commit")}
    </Button>
  ) : commitment.isCommitted ? (
    <Button size="lg" variant="secondary" className="h-11 w-full rounded-xl" disabled>
      <Check aria-hidden /> {t("hunt.cta.committed")}
    </Button>
  ) : (
    <Button size="lg" className="h-11 w-full rounded-xl" onClick={() => setCommitOpen(true)}>
      {t("hunt.cta.commit")}
    </Button>
  );

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <Link to="/" className="text-sm text-muted-foreground hover:underline">
        {t("common.back")}
      </Link>

      {/* L'essentiel : état, titre, lieu, date */}
      <div className="mt-5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <HuntStatusBadge status={status} />
        {commitsOpen && !isExpired && (
          <span>
            {t("hunt.timeLeft")} <Countdown targetDate={hunt.deadline} onExpire={refresh} />
          </span>
        )}
      </div>
      <h1 className="mt-3 text-2xl font-semibold leading-snug tracking-tight">{hunt.title}</h1>
      <p className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
        <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          {placeLabel(hunt, t)}
          {hunt.country && ` · ${countryName(hunt.country, locale)}`}
        </span>
      </p>
      <p className="mt-1 flex items-start gap-2 text-sm text-muted-foreground">
        <CalendarClock className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          {t("hunt.before", {
            date: date(hunt.deadline, { dateStyle: "long", timeStyle: "short" }),
          })}
        </span>
      </p>

      {/* Mode chaîne : transaction envoyée, pas encore vue par l'index */}
      {pending && (
        <p role="status" className="mt-4 rounded-xl border bg-muted p-3 text-sm">
          {t("hunt.pending")}
        </p>
      )}
      {/* Mode chaîne : date limite passée, résultat pas encore confirmé */}
      {outcomePending && (
        <p role="status" className="mt-4 rounded-xl border bg-muted p-3 text-sm">
          {t("hunt.outcomePending")}
        </p>
      )}

      {/* Bannières d'état */}
      {isActivated && (
        <div className="mt-4 rounded-xl bg-primary p-4 text-primary-foreground">
          <p className="font-semibold">{t("hunt.banner.activated")}</p>
          {commitsOpen && <p className="mt-1 text-sm opacity-90">{t("hunt.banner.stillOpen")}</p>}
        </div>
      )}
      {isExpired && !isActivated && (
        <div className="mt-4 rounded-xl border bg-muted p-4 text-sm text-muted-foreground">
          {t("hunt.banner.expired")}
        </div>
      )}

      {/* Le chiffre qui compte, et le bouton */}
      <section className="mt-5 rounded-2xl border bg-card p-4 text-center">
        <p className="text-4xl font-semibold tracking-tight text-highlight">{hunt.threshold}</p>
        <p className="mt-1 font-medium">{t("hunt.big.needed")}</p>
        {isProgressVisible(hunt, status) ? (
          <div className="mx-auto mt-3 max-w-xs">
            <ProgressBar value={retainedCount ?? commitCount} max={hunt.threshold} />
            <p className="mt-1 text-sm text-muted-foreground">
              {t("hunt.big.count", { count: retainedCount ?? commitCount })}
            </p>
          </div>
        ) : (
          commitsOpen && (
            <p className="mt-1 text-sm text-muted-foreground">{t("hunt.big.otherwise")}</p>
          )
        )}
        <div className="mt-4">{cta}</div>
        {commitsOpen && !commitment.isCommitted && (
          <p className="mt-3 text-sm text-muted-foreground">
            {t("hunt.reassure", { threshold: hunt.threshold })}
          </p>
        )}

        {/* Condition personnelle (visible seulement par l'engagé·e concerné·e) */}
        {commitment.isCommitted &&
          wallet.address &&
          (() => {
            const mine = getMyPersonalThreshold(hunt, wallet.address);
            if (mine === undefined || mine === hunt.threshold) return null;
            // Engagement conditionnel : son état est donné par AfterNote.
            if (getMyCommitment(wallet.address, hunt.id)?.after) return null;
            const met = retainedThreshold !== null && mine <= retainedThreshold;
            return (
              <p className="mt-3 text-sm" role="status">
                {t("hunt.condition", { count: mine })}{" "}
                {met ? (
                  <span className="font-medium text-primary">{t("hunt.condition.met")}</span>
                ) : (
                  <span className="text-muted-foreground">
                    {t("hunt.condition.pending", { amount: hunt.commitDeposit })}
                  </span>
                )}
              </p>
            );
          })()}
        {/* Engagement conditionnel : il attend une autre action */}
        {commitment.isCommitted &&
          wallet.address &&
          (() => {
            const after = getMyCommitment(wallet.address, hunt.id)?.after;
            return after ? <AfterNote afterId={after} /> : null;
          })()}
        {/* Changer d'avis : retrait possible jusqu'au déclenchement */}
        <WithdrawBox commitment={commitment} />
        {commitment.error && commitment.isCommitted && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {commitment.error}
          </p>
        )}
      </section>

      {/* Faire venir du monde */}
      {!(isCreator && commitsOpen) && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <ShareHuntButton hunt={hunt} />
          <ReplyOnXButton hunt={hunt} />
        </div>
      )}

      {/* Encadré du créateur : mobiliser pendant que l'action est ouverte */}
      {isCreator && commitsOpen && (
        <section aria-labelledby="creator-box" className="mt-4 rounded-2xl border bg-accent p-5">
          <h2 id="creator-box" className="font-semibold text-accent-foreground">
            {t("creator.title")}
          </h2>
          <p className="mt-1 text-sm">{t("creator.text")}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <ShareHuntButton hunt={hunt} />
            <ReplyOnXButton hunt={hunt} />
          </div>
        </section>
      )}

      {/* Ce qu'on fera */}
      <p className="mt-6 whitespace-pre-line text-sm leading-relaxed">{hunt.description}</p>

      {/* Salon chiffré des membres : n'existe qu'après l'activation (jamais avant). */}
      <div className="mt-8">
        {canOpenChat(status, outcome) && getDataMode() === "chain" ? (
          // Action sur la chaîne : chat chiffré entre membres, sans serveur.
          <P2PChatPanel
            huntId={hunt.id}
            title={hunt.title}
            {...(search.code ? { prefillCode: search.code } : {})}
          />
        ) : canOpenChat(status, outcome) ? (
          // Mode démo (actions de ce navigateur) : pas de membres sur la chaîne.
          <section className="rounded-2xl border bg-card p-4 text-sm">
            <h2 className="mb-1 font-semibold">{t("hunt.chat.title")}</h2>
            <p className="text-muted-foreground">{t("chat.soon")}</p>
          </section>
        ) : (
          <section className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
            <h2 className="mb-1 font-semibold text-foreground">{t("hunt.chat.title")}</h2>
            {isExpired || (status === "settled" && outcome === "failure")
              ? t("hunt.chat.expired")
              : t("hunt.chat.later")}
          </section>
        )}
      </div>

      {/* Le reste, pour qui veut les détails */}
      <details className="group mt-6 rounded-2xl border bg-card p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between rounded-md font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {t("hunt.more")}
          <ChevronDown
            className="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none"
            aria-hidden
          />
        </summary>
        <p className="mt-3 text-sm text-muted-foreground">
          {t("hunt.explain", { threshold: hunt.threshold })}{" "}
          <Link to="/" hash="how" className="underline underline-offset-2">
            {t("hunt.explain.link")}
          </Link>
        </p>
        {commitsOpen && (
          <p className="mt-2 text-sm text-muted-foreground">
            {commitRefundShort(hunt.deposit, locale)}
          </p>
        )}
        <dl className="mt-4 space-y-2 text-sm">
          <Info label={t("hunt.commitDeposit")}>{hunt.commitDeposit} KAS</Info>
          <Info label={t("hunt.caution")}>{hunt.deposit} KAS</Info>
        </dl>
        {/* Pass de groupe : une association offre des places (mode chaîne). */}
        {commitsOpen && getDataMode() === "chain" && (
          <Link
            to="/group"
            search={{ hunt: hunt.id }}
            className="mt-4 inline-block text-sm text-muted-foreground underline underline-offset-2"
          >
            {t("group.offer")}
          </Link>
        )}
        {/* Résolution économique (simulée, aucun transfert) */}
        <div className="mt-4">
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
      </details>

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
    <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
