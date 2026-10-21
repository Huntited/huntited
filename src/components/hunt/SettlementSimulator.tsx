// Simulation avant de s'engager ou de créer une chasse : on fait varier le
// nombre de personnes engagées et on voit, en KAS, ce que devient la caution
// du créateur ou le dépôt d'un·e engagé·e (calculs de hunt-economics.ts, les
// mêmes que pour le règlement réel).
import { CheckCircle2, CircleSlash } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Slider } from "@/components/ui/slider";
import { REGISTRY_FEE_SOMPI } from "@/lib/chain";
import {
  COMMIT_DEPOSIT_SOMPI,
  MAX_CAUTION_KAS,
  MIN_CAUTION_KAS,
  SOMPI_PER_KAS,
  calculateSettlement,
  sompiToKasFr,
  sompiToKasText,
} from "@/lib/hunt-economics";
import { getDataMode } from "@/lib/hunt-repository";
import { useI18n } from "@/lib/i18n";

interface Props {
  role: "creator" | "participant";
  /** Caution du créateur, en KAS. */
  cautionKas: number;
  threshold: number;
  /** Engagé·e : seuil personnel (« je viens si au moins N personnes viennent »). */
  personalThreshold?: number;
}

export function SettlementSimulator({ role, cautionKas, threshold, personalThreshold }: Props) {
  const { t, locale } = useI18n();
  const validThreshold = Number.isInteger(threshold) && threshold > 0 ? threshold : 7;
  const max = Math.max(validThreshold * 3, validThreshold + 10);
  const [count, setCount] = useState<number | null>(null);
  const n = Math.min(count ?? validThreshold, max);

  const caution =
    BigInt(
      Number.isInteger(cautionKas) && cautionKas >= MIN_CAUTION_KAS && cautionKas <= MAX_CAUTION_KAS
        ? cautionKas
        : MIN_CAUTION_KAS,
    ) * SOMPI_PER_KAS;
  const success = n >= validThreshold;
  const s = calculateSettlement(n, success ? "success" : "failure", caution);
  // Engagé·e dont le seuil personnel n'est pas atteint : dépôt rendu, sans récompense.
  const notRetained =
    role === "participant" && success && personalThreshold !== undefined && n < personalThreshold;
  const kas = (v: bigint) =>
    `${locale === "fr" ? sompiToKasFr(v) : sompiToKasText(((v + 500_000n) / 1_000_000n) * 1_000_000n)} KAS`;
  const onChain = getDataMode() === "chain";

  return (
    <section className="space-y-3 rounded-lg border bg-card p-4" aria-label={t("sim.title")}>
      <div className="flex items-end justify-between gap-4">
        <div className="flex-1 space-y-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {t("sim.people")}
          </p>
          <Slider
            min={0}
            max={max}
            step={1}
            value={[n]}
            onValueChange={([v]) => setCount(v ?? validThreshold)}
            aria-label={t("sim.people")}
          />
          <div className="relative h-4 text-[11px] text-muted-foreground">
            <span className="absolute left-0">0</span>
            <span
              className="absolute -translate-x-1/2 font-medium text-foreground"
              style={{ left: `${(validThreshold / max) * 100}%` }}
            >
              {t("sim.threshold", { n: validThreshold })}
            </span>
            <span className="absolute right-0">{max}</span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-4xl font-semibold tabular-nums leading-none">{n}</p>
          <p className="text-xs text-muted-foreground">{t("sim.committed")}</p>
        </div>
      </div>

      <p
        className={`flex items-center gap-1.5 text-sm font-medium ${success ? "text-green-700 dark:text-green-400" : "text-muted-foreground"}`}
        aria-live="polite"
      >
        {success ? (
          <CheckCircle2 className="size-4" aria-hidden />
        ) : (
          <CircleSlash className="size-4" aria-hidden />
        )}
        {success ? t("sim.success") : t("sim.failure", { n: validThreshold - n })}
      </p>

      {role === "creator" ? (
        <div className="grid gap-2 sm:grid-cols-3">
          <Card label={t("sim.creator.caution")} value={kas(caution)} sub={t("sim.locked")} />
          <Card
            label={t("sim.creator.back")}
            value={kas(s.creatorCreationRefundSompi)}
            sub={t("sim.creator.fee", { fee: kas(s.treasurySompi) })}
            strong
          />
          <Card
            label={t("sim.creator.paid")}
            value={kas(s.participantBonusPerCommitSompi * BigInt(n))}
            sub={
              success
                ? t("sim.creator.per", { per: kas(s.participantBonusPerCommitSompi) })
                : t("sim.creator.none")
            }
          />
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-3">
          <Card
            label={t("sim.part.deposit")}
            value={kas(COMMIT_DEPOSIT_SOMPI)}
            sub={t("sim.locked")}
          />
          <Card
            label={t("sim.part.back")}
            value={kas(COMMIT_DEPOSIT_SOMPI)}
            sub={t("sim.part.always")}
          />
          <Card
            label={t("sim.part.reward")}
            value={`+ ${kas(notRetained ? 0n : s.participantBonusPerCommitSompi)}`}
            sub={
              notRetained
                ? t("sim.part.notRetained", { n: personalThreshold! })
                : success
                  ? t("sim.part.fromCreator")
                  : t("sim.part.onlyIf")
            }
            strong={success && !notRetained}
          />
        </div>
      )}

      <ul className="space-y-0.5 text-xs text-muted-foreground">
        {onChain && (
          <li>
            {t(role === "creator" ? "sim.fee.create" : "sim.fee.commit", {
              fee: kas(BigInt(REGISTRY_FEE_SOMPI)),
            })}
          </li>
        )}
        <li>{t("sim.simulated")}</li>
      </ul>
    </section>
  );
}

function Card({
  label,
  value,
  sub,
  strong,
}: {
  label: string;
  value: ReactNode;
  sub: string;
  strong?: boolean;
}) {
  return (
    <div className="rounded-md border bg-background p-3">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={`mt-1 text-xl font-semibold tabular-nums ${strong ? "text-green-700 dark:text-green-400" : ""}`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}
