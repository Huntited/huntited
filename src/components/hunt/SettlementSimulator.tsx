// Simulation avant de créer une chasse ou de s'engager, en KAS (calculs de
// hunt-economics.ts, les mêmes que pour le règlement réel) :
// - créateur : la barre règle le seuil de la chasse (reliée au champ du
//   formulaire, dans les deux sens) ; on voit ce que devient la caution si
//   l'action a lieu, et sinon ;
// - engagé·e : la barre fait varier le nombre de personnes engagées.
import { CheckCircle2, CircleSlash } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

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
import { minHuntThreshold } from "@/lib/validation";

interface Props {
  role: "creator" | "participant";
  /** Caution du créateur, en KAS. */
  cautionKas: number;
  threshold: number;
  /** Engagé·e : seuil personnel (« je viens si au moins N personnes viennent »). */
  personalThreshold?: number;
  /** Créateur : la barre modifie le seuil du formulaire. */
  onThresholdChange?: (threshold: number) => void;
}

/** Montant affichable (2 décimales au plus). */
function useKas() {
  const { locale } = useI18n();
  return (v: bigint) =>
    `${locale === "fr" ? sompiToKasFr(v) : sompiToKasText(((v + 500_000n) / 1_000_000n) * 1_000_000n)} KAS`;
}

const cautionSompi = (cautionKas: number) =>
  BigInt(
    Number.isInteger(cautionKas) && cautionKas >= MIN_CAUTION_KAS && cautionKas <= MAX_CAUTION_KAS
      ? cautionKas
      : MIN_CAUTION_KAS,
  ) * SOMPI_PER_KAS;

/** Crans de la barre du seuil (plus fins pour les petits seuils). */
const STOPS = [7, 8, 9, 10, 12, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200, 300, 500, 1000];
const LABELS = [7, 10, 25, 50, 100, 200, 1000];

export function SettlementSimulator(props: Props) {
  return props.role === "creator" ? (
    <CreatorSimulator {...props} />
  ) : (
    <ParticipantSimulator {...props} />
  );
}

/** Créateur : choisir le seuil et voir ce que devient la caution. */
function CreatorSimulator({ cautionKas, threshold, onThresholdChange }: Props) {
  const { t } = useI18n();
  const kas = useKas();
  const min = minHuntThreshold();
  const stops = [...new Set([min, ...STOPS.filter((v) => v >= min)])].sort((a, b) => a - b);
  const valid = Number.isInteger(threshold) && threshold >= min ? threshold : min;
  // Cran le plus proche (en dessous) du seuil saisi.
  const index = Math.max(0, stops.filter((v) => v <= valid).length - 1);
  const last = stops.length - 1;
  const at = (i: number) => `calc(8px + (100% - 16px) * ${i / last})`;

  const caution = cautionSompi(cautionKas);
  const win = calculateSettlement(valid, "success", caution);
  const lose = calculateSettlement(valid, "failure", caution);
  const onChain = getDataMode() === "chain";

  return (
    <section className="space-y-3 rounded-lg border bg-card p-4" aria-label={t("sim.title")}>
      <div className="flex items-end justify-between gap-4">
        <div className="flex-1 space-y-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {t("sim.creator.threshold")}
          </p>
          <Slider
            min={0}
            max={last}
            step={1}
            value={[index]}
            onValueChange={([i]) => onThresholdChange?.(stops[i ?? 0] ?? min)}
            aria-label={t("sim.creator.threshold")}
          />
          <div className="relative h-4 text-[11px] text-muted-foreground">
            {LABELS.filter((v) => stops.includes(v)).map((v) => {
              const i = stops.indexOf(v);
              return (
                <button
                  key={v}
                  type="button"
                  className={`absolute -translate-x-1/2 hover:text-foreground ${v === valid ? "font-semibold text-foreground" : ""}`}
                  style={{ left: at(i) }}
                  onClick={() => onThresholdChange?.(v)}
                >
                  {v}
                </button>
              );
            })}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-4xl font-semibold tabular-nums leading-none">{valid}</p>
          <p className="text-xs text-muted-foreground">{t("sim.creator.minimum")}</p>
        </div>
      </div>

      {/* Deux issues, en une ligne chacune. */}
      <div className="grid grid-cols-2 gap-2">
        <Card
          label={t("sim.creator.ifYes")}
          value={kas(win.creatorCreationRefundSompi)}
          sub={t("sim.creator.ifYesShort", { per: kas(win.participantBonusPerCommitSompi) })}
          strong
        />
        <Card
          label={t("sim.creator.ifNo")}
          value={kas(lose.creatorCreationRefundSompi)}
          sub={t("sim.creator.ifNoShort")}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        {onChain
          ? t("sim.creator.noteChain", { fee: kas(BigInt(REGISTRY_FEE_SOMPI)) })
          : t("sim.simulated")}
      </p>
    </section>
  );
}

/** Engagé·e : selon le nombre de personnes engagées, ce qu'on récupère. */
function ParticipantSimulator({ cautionKas, threshold, personalThreshold }: Props) {
  const { t } = useI18n();
  const validThreshold = Number.isInteger(threshold) && threshold > 0 ? threshold : 7;
  const max = Math.max(validThreshold * 3, validThreshold + 10);
  const [count, setCount] = useState<number | null>(null);
  // Le seuil change (formulaire) : le curseur revient dessus.
  useEffect(() => setCount(null), [validThreshold]);
  const n = Math.min(count ?? validThreshold, max);
  // Position sur la piste, alignée sur le centre du curseur (16 px de large).
  const at = (v: number) => `calc(8px + (100% - 16px) * ${v / max})`;

  const caution = cautionSompi(cautionKas);
  const success = n >= validThreshold;
  const s = calculateSettlement(n, success ? "success" : "failure", caution);
  // Engagé·e dont le seuil personnel n'est pas atteint : dépôt rendu, sans récompense.
  const notRetained = success && personalThreshold !== undefined && n < personalThreshold;
  const kas = useKas();
  const onChain = getDataMode() === "chain";

  return (
    <section className="space-y-3 rounded-lg border bg-card p-4" aria-label={t("sim.title")}>
      <div className="flex items-end justify-between gap-4">
        <div className="flex-1 space-y-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {t("sim.people")}
          </p>
          <div className="relative">
            {/* Repère du seuil, sur la piste. */}
            <span
              aria-hidden
              className="pointer-events-none absolute top-1/2 z-[1] h-3 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded bg-green-600"
              style={{ left: at(validThreshold) }}
            />
            <Slider
              min={0}
              max={max}
              step={1}
              value={[n]}
              onValueChange={([v]) => setCount(v ?? validThreshold)}
              aria-label={t("sim.people")}
            />
          </div>
          <div className="relative h-4 text-[11px] text-muted-foreground">
            <span className="absolute left-0">0</span>
            <button
              type="button"
              className="absolute -translate-x-1/2 whitespace-nowrap font-medium text-green-700 hover:underline dark:text-green-400"
              style={{ left: at(validThreshold) }}
              onClick={() => setCount(validThreshold)}
            >
              {t("sim.threshold", { n: validThreshold })}
            </button>
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
        {success
          ? t("sim.success")
          : t(validThreshold - n === 1 ? "sim.failure.one" : "sim.failure", {
              n: validThreshold - n,
            })}
      </p>

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

      <ul className="space-y-0.5 text-xs text-muted-foreground">
        {onChain && <li>{t("sim.fee.commit", { fee: kas(BigInt(REGISTRY_FEE_SOMPI)) })}</li>}
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
