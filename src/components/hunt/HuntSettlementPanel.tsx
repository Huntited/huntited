import { Button } from "@/components/ui/button";
import { calculateSettlement, sompiToKasText } from "@/lib/hunt-economics";
import { COMMIT_DEPOSIT_TERMS, CREATE_DEPOSIT_TERMS } from "@/lib/terms";
import type { SettlementOutcome } from "@/lib/hunt-state-store";
import type { Hunt, HuntStatus } from "@/lib/types";

interface HuntSettlementPanelProps {
  hunt: Hunt;
  commitCount: number;
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
  status,
  outcome,
  onSettle,
}: HuntSettlementPanelProps) {
  if (status === "active" || status === "draft") {
    return (
      <section className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
        <h2 className="mb-1 font-semibold text-foreground">Résolution</h2>
        La résolution n'est pas encore disponible : elle aura lieu quand le seuil sera atteint ou à
        la date limite.
      </section>
    );
  }

  // Une chasse résolue garde l'issue déterminée par son compteur.
  const success =
    status === "activated" ||
    (status === "settled" && (outcome ? outcome === "success" : commitCount >= hunt.threshold));
  const s = calculateSettlement(commitCount, success ? "success" : "failure");

  return (
    <section className="space-y-3 rounded-lg border bg-card p-4 text-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Résolution {status === "settled" ? "(effectuée)" : "(simulation)"}
        </p>
        <h2 className="text-lg font-bold">{success ? "Succès" : "Échec"}</h2>
      </div>

      <dl className="space-y-1">
        <Row label="Remboursement création (créateur)" value={s.creatorCreationRefundSompi} />
        {success ? (
          <>
            <Row label="Part créateur (95 % des engagements)" value={s.creatorCommitRewardSompi} />
            <Row label="Treasury (5 % des engagements)" value={s.treasurySompi} />
            <Row label="Remboursement par engagé·e" value={s.participantRefundPerCommitSompi} />
          </>
        ) : (
          <>
            <Row label="Remboursement par engagé·e" value={s.participantRefundPerCommitSompi} />
            <Row label="Bonus d'échec par engagé·e" value={s.participantBonusPerCommitSompi} />
            <Row label="Treasury" value={s.treasurySompi} />
          </>
        )}
      </dl>

      <p className="text-xs text-muted-foreground">
        {COMMIT_DEPOSIT_TERMS} {CREATE_DEPOSIT_TERMS}
      </p>
      <p className="text-xs font-medium">Simulation locale — Aucun KAS transféré.</p>

      {import.meta.env.DEV && onSettle && status !== "settled" && (
        <Button variant="outline" size="sm" onClick={onSettle}>
          Simuler le règlement
        </Button>
      )}
    </section>
  );
}

function Row({ label, value }: { label: string; value: bigint }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{sompiToKasText(value)} KAS</dd>
    </div>
  );
}
