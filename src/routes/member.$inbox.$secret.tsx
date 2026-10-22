// Pass d'organisation, côté adhérent : un lien personnel permanent. Il montre
// les chasses que l'organisation a ouvertes à ses adhérents ; l'adhérent s'y
// engage sans wallet (page de place, clé dérivée pour chaque chasse).
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { getChainMemberHunts, type ChainHuntView } from "@/lib/onchain/browser-index";
import { memberPlaceKey } from "@/lib/org-pass";
import { placePublic } from "@/lib/group-pass";

export const Route = createFileRoute("/member/$inbox/$secret")({
  head: () => ({
    meta: [{ title: "Mon pass d'organisation — Huntited" }, { name: "robots", content: "noindex" }],
  }),
  component: MemberPage,
});

const HEX64 = /^[0-9a-f]{64}$/;

function MemberPage() {
  const { inbox, secret } = Route.useParams();
  const { t, date } = useI18n();
  const valid = HEX64.test(inbox) && HEX64.test(secret);
  const [hunts, setHunts] = useState<{ view: ChainHuntView; used: boolean }[] | null>(null);
  const keys = useMemo(() => new Map<string, string>(), []);
  const placeKey = (hunt: string) => {
    if (!keys.has(hunt)) keys.set(hunt, memberPlaceKey(secret, hunt));
    return keys.get(hunt)!;
  };

  useEffect(() => {
    if (!valid) return;
    let cancelled = false;
    const load = () =>
      void getChainMemberHunts((h) => placePublic(placeKey(h)))
        .then((list) => !cancelled && setHunts(list))
        .catch(() => !cancelled && setHunts([]));
    load();
    const timer = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valid, secret]);

  if (!valid) {
    return (
      <p className="mx-auto max-w-xl px-4 py-10 text-sm text-muted-foreground">
        {t("place.invalid")}
      </p>
    );
  }

  const open = (hunts ?? []).filter((h) => h.view.commitsOpen || h.used);
  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{t("member.kicker")}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{t("member.title")}</h1>
      <p className="mt-2 rounded-md border bg-muted/40 p-3 text-sm">{t("member.lead")}</p>

      {hunts === null ? (
        <p className="mt-6 text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : open.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">{t("member.none")}</p>
      ) : (
        <ul className="mt-6 divide-y border-y text-sm">
          {open.map(({ view, used }) => (
            <li key={view.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <span>
                <span className="font-medium">{view.title}</span>
                <span className="block text-xs text-muted-foreground">
                  {t("place.meta", {
                    threshold: view.threshold,
                    date: date(view.deadline, { dateStyle: "medium", timeStyle: "short" }),
                  })}
                </span>
              </span>
              {used ? (
                <Link
                  to="/hunt/$id"
                  params={{ id: view.id }}
                  className="text-green-700 underline dark:text-green-400"
                >
                  {t("member.joined")}
                </Link>
              ) : (
                <Button asChild size="sm">
                  <Link
                    to="/place/$hunt/$key/$inbox"
                    params={{ hunt: view.id, key: placeKey(view.id), inbox }}
                  >
                    {t("member.join")}
                  </Link>
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-6 text-xs text-muted-foreground">{t("member.keep")}</p>
    </div>
  );
}
