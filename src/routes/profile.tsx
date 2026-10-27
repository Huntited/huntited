// « Ma progression » : côté RP (src/lib/rpg.ts, docs/rpg.md). Niveau, titre,
// expérience, classe et quêtes de la semaine, calculés à partir des actions
// réelles du wallet sur la blockchain. Visible des autres seulement dans les
// salons de leurs chasses communes.
import { createFileRoute } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { getDataMode } from "@/lib/hunt-repository";
import { useI18n } from "@/lib/i18n";
import { getChainDeeds } from "@/lib/onchain/browser-index";
import {
  CLASSES,
  computeXp,
  QUESTS,
  questProgress,
  rankOf,
  weekStart,
  type ChainDeed,
  type ClassId,
} from "@/lib/rpg";
import { getMyClass, setMyClass } from "@/lib/rpg-profile";
import { useWallet } from "@/lib/useWallet";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Ma progression — Huntited" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { t } = useI18n();
  const wallet = useWallet();
  const [deeds, setDeeds] = useState<ChainDeed[] | null>(null);
  const [error, setError] = useState(false);
  const [cls, setCls] = useState<ClassId | undefined>(undefined);
  useEffect(() => setCls(getMyClass()), []);

  useEffect(() => {
    if (!wallet.address || getDataMode() !== "chain") return;
    setError(false);
    void getChainDeeds(wallet.address)
      .then(setDeeds)
      .catch(() => setError(true));
  }, [wallet.address]);

  const xp = deeds ? computeXp(deeds, cls) : null;
  const rank = xp ? rankOf(xp.total) : null;
  const progress = deeds ? questProgress(deeds, weekStart(Date.now())) : null;

  return (
    <div className="mx-auto max-w-xl space-y-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("rpg.page.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("rpg.page.lead")}</p>
      </div>

      {!wallet.isConnected ? (
        <div className="space-y-2 rounded-lg border bg-card p-4 text-sm">
          <p>{t("rpg.page.connect")}</p>
          <Button size="sm" onClick={() => void wallet.connectWallet()}>
            {t("wallet.connect")}
          </Button>
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">{t("err.unavailable")}</p>
      ) : !rank || !xp ? (
        <p className="text-sm text-muted-foreground" role="status">
          {t("chat.p2p.loading")}
        </p>
      ) : (
        <>
          <section className="space-y-3 rounded-lg border bg-card p-4 text-sm">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("rpg.page.rank")}
            </p>
            <p className="text-2xl font-semibold">
              {t("rpg.level", { n: rank.level })} · {t(`rpg.title.${rank.title}`)}
            </p>
            <div
              className="h-2 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuemin={rank.from}
              aria-valuemax={rank.to}
              aria-valuenow={rank.xp}
              aria-label={t("rpg.page.xp", { xp: rank.xp, next: rank.to })}
            >
              <div
                className="h-full bg-primary"
                style={{ width: `${((rank.xp - rank.from) / (rank.to - rank.from)) * 100}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {t("rpg.page.xp", { xp: rank.xp, next: rank.to })}
            </p>
            <ul className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
              <li>{t("rpg.xp.engage", { n: xp.engage })}</li>
              <li>{t("rpg.xp.create", { n: xp.create })}</li>
              <li>{t("rpg.xp.success", { n: xp.success })}</li>
              <li>{t("rpg.xp.quests", { n: xp.quests })}</li>
            </ul>
          </section>

          <section className="space-y-3 rounded-lg border bg-card p-4 text-sm">
            <h2 className="font-semibold">{t("rpg.page.class")}</h2>
            <p className="text-xs text-muted-foreground">{t("rpg.page.classLead")}</p>
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
              {CLASSES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={cls === c.id}
                  onClick={() => {
                    setMyClass(c.id);
                    setCls(c.id);
                  }}
                  className={`rounded-md border p-3 text-left ${cls === c.id ? "border-primary bg-primary/10" : ""}`}
                >
                  <span className="flex items-center gap-1 font-medium">
                    {cls === c.id && <Check className="size-4" aria-hidden />}
                    {t(`rpg.class.${c.id}`)}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {t(`rpg.classDesc.${c.id}`)}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-3 rounded-lg border bg-card p-4 text-sm">
            <h2 className="font-semibold">{t("rpg.page.quests")}</h2>
            <ul className="space-y-2">
              {QUESTS.map((q) => {
                const n = Math.min(progress?.[q.id] ?? 0, q.goal);
                const done = n >= q.goal;
                return (
                  <li key={q.id} className="flex items-center justify-between gap-2">
                    <span className={done ? "text-muted-foreground line-through" : ""}>
                      {t(`rpg.quest.${q.id}`)}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {done ? (
                        <Check className="inline size-4" aria-label={t("rpg.page.done")} />
                      ) : (
                        `${n}/${q.goal}`
                      )}{" "}
                      · +{q.xp} XP
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-muted-foreground">{t("rpg.page.questsNote")}</p>
          </section>

          <p className="text-xs text-muted-foreground">{t("rpg.page.privacy")}</p>
        </>
      )}
    </div>
  );
}
