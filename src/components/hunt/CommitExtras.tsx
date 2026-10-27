// Engagement, en plus du seuil personnel (docs/chasses-enchainees.md) :
// - retrait, tant que la chasse n'est pas déclenchée ;
// - condition : « seulement si telle autre chasse se déclenche d'abord ».
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { listHuntViews, type HuntView } from "@/lib/hunt-repository";
import { useI18n } from "@/lib/i18n";
import { useHunt } from "@/lib/useHunt";
import type { UseCommitmentResult } from "@/lib/useCommitment";

/** Retirer son engagement (deux clics : on confirme avant d'envoyer). */
export function WithdrawBox({ commitment }: { commitment: UseCommitmentResult }) {
  const { t } = useI18n();
  const [confirming, setConfirming] = useState(false);
  if (!commitment.canWithdraw && !commitment.isSubmitting) return null;
  return (
    <div className="mt-3 space-y-2 text-sm">
      {!confirming ? (
        <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
          {t("withdraw.button")}
        </Button>
      ) : (
        <div className="space-y-2 rounded-lg border p-3">
          <p>{t("withdraw.confirmText")}</p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              disabled={commitment.isSubmitting}
              onClick={() =>
                void commitment
                  .withdraw()
                  .then(() => setConfirming(false))
                  .catch(() => undefined)
              }
            >
              {commitment.isSubmitting ? t("withdraw.sending") : t("withdraw.confirm")}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setConfirming(false)}>
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      )}
      <p className="text-xs text-muted-foreground">{t("withdraw.hint")}</p>
    </div>
  );
}

/** Mon engagement attend une autre chasse : laquelle, et où elle en est. */
export function AfterNote({ afterId }: { afterId: string }) {
  const { t } = useI18n();
  const { hunt, status } = useHunt(afterId);
  const done = status === "activated" || status === "settled";
  return (
    <p className="mt-2 text-sm" role="status">
      {t("after.mine")}{" "}
      <Link to="/hunt/$id" params={{ id: afterId }} className="font-medium underline">
        {hunt?.title ?? afterId.slice(0, 8)}
      </Link>{" "}
      {done ? (
        <span className="font-medium text-green-700 dark:text-green-400">{t("after.met")}</span>
      ) : (
        <span className="text-muted-foreground">{t("after.waiting")}</span>
      )}
    </p>
  );
}

/** Choix facultatif de la chasse qui doit se déclencher d'abord. */
export function AfterPicker({
  huntId,
  value,
  onChange,
}: {
  huntId: string;
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const { t } = useI18n();
  const [options, setOptions] = useState<HuntView[]>([]);
  useEffect(() => {
    let live = true;
    void listHuntViews()
      .then((vs) => {
        if (live) setOptions(vs.filter((v) => v.hunt.id !== huntId && v.commitsOpen));
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [huntId]);
  if (options.length === 0) return null;
  return (
    <div className="space-y-2 rounded-lg border p-4 text-sm">
      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={value !== null}
          onChange={(e) => onChange(e.target.checked ? options[0]!.hunt.id : null)}
          className="mt-1"
        />
        <span>{t("after.label")}</span>
      </label>
      {value !== null && (
        <select
          aria-label={t("after.select")}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-full rounded border bg-background px-2"
        >
          {options.map((v) => (
            <option key={v.hunt.id} value={v.hunt.id}>
              {v.hunt.title}
              {v.status === "activated" ? ` (${t("after.alreadyOn")})` : ""}
            </option>
          ))}
        </select>
      )}
      <p className="text-xs text-muted-foreground">{t("after.help")}</p>
    </div>
  );
}
