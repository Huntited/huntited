import { Button } from "@/components/ui/button";
import { SOMPI_PER_KAS, calculateSettlement, sompiToKasText } from "@/lib/hunt-economics";
import { useI18n } from "@/lib/i18n";
import { commitDepositTerms, createDepositTerms } from "@/lib/terms";
import type { SettlementOutcome } from "@/lib/hunt-state-store";
import type { Hunt, HuntStatus } from "@/lib/types";

interface HuntSettlementPanelProps {
  hunt: Hunt;
  /** Nombre total d'engagé·es. */
  commitCount: number;
  /** Taille du groupe retenu (seuils personnels) ; = commitCount sans seuils personnels. */
  retainedCount?: number;
  status: HuntStatus;
  /** Issue persistée lorsque la chasse est résolue. */
  outcome?: SettlementOutcome | undefined;
  /** Simulation de résolution (bouton visible en développement uniquement). */
  onSettle?: () => void;
}

/**
 * Résolution économique d'une chasse — mock pur, aucun KAS n'est transféré.
 * Les paiements réels seront exécutés par le covenant Kaspa.
 */
export function HuntSettlementPanel({
  hunt,
  commitCount,
  retainedCount = commitCount,
  status,
  outcome,
  onSettle,
}: HuntSettlementPanelProps) {
  const { t, locale } = useI18n();
  if (status === "active" || status === "draft") {
    return (
      <section className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
        <h2 className="mb-1 font-semibold text-foreground">{t("settle.title")}</h2>
        {t("settle.notYet")}
      </section>
    );
  }

  // Une chasse résolue garde l'issue déterminée par son groupe retenu.
  const success =
    status === "activated" ||
    (status === "settled" && (outcome ? outcome === "success" : retainedCount >= hunt.threshold));
  // Succès : seuls les retenu·es financent ; échec : tous sont remboursés.
  const s = calculateSettlement(
    success ? retainedCount : commitCount,
    success ? "success" : "failure",
    BigInt(hunt.deposit) * SOMPI_PER_KAS,
  );
  const nonRetained = Math.max(0, commitCount - retainedCount);
  const fr = locale === "fr";

  return (
    <section className="space-y-3 rounded-lg border bg-card p-4 text-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t(status === "settled" ? "settle.done" : "settle.simulation")}
        </p>
        <h2 className="text-lg font-bold">{t(success ? "settle.success" : "settle.failure")}</h2>
      </div>

      <dl className="space-y-1">
        <Row label={t("settle.refund")} value={s.participantRefundPerCommitSompi} fr={fr} />
        {success && (
          <Row label={t("settle.reward")} value={s.participantBonusPerCommitSompi} fr={fr} />
        )}
        <Row label={t("settle.creatorRefund")} value={s.creatorCreationRefundSompi} fr={fr} />
        <Row label="Huntited" value={s.treasurySompi} fr={fr} />
        {success && nonRetained > 0 && (
          <Row
            label={t("settle.nonRetained", { count: nonRetained })}
            value={s.nonRetainedRefundPerCommitSompi}
            fr={fr}
          />
        )}
      </dl>

      <p className="text-xs text-muted-foreground">
        {commitDepositTerms(hunt.deposit, locale)} {createDepositTerms(hunt.deposit, locale)}
      </p>
      <p className="text-xs font-medium">{t("settle.noTransfer")}</p>

      {import.meta.env.DEV && onSettle && status !== "settled" && (
        <Button variant="outline" size="sm" onClick={onSettle}>
          {t("settle.simulate")}
        </Button>
      )}
    </section>
  );
}

function Row({ label, value, fr }: { label: string; value: bigint; fr: boolean }) {
  const amount = sompiToKasText(value);
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{fr ? amount.replace(".", ",") : amount} KAS</dd>
    </div>
  );
}
