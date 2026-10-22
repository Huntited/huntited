// Place offerte par une association (pass de groupe, docs/pass-groupe.md) :
// le membre s'engage sans wallet ni KAS. Sa demande, signée par la clé de la
// place, est chiffrée pour l'association, qui l'inscrit sur la blockchain.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  myPlaceRequest,
  placePublic,
  rememberPlaceRequest,
  sealPlaceRequest,
} from "@/lib/group-pass";
import { useI18n } from "@/lib/i18n";
import { createRelayPool, nostrRelays } from "@/lib/nostr-relays";
import { getChainHunt, getChainPlaces, type ChainHuntView } from "@/lib/onchain/browser-index";
import { ensureChatKey } from "@/lib/p2p-chat";

export const Route = createFileRoute("/place/$hunt/$key/$inbox")({
  head: () => ({
    meta: [{ title: "Ta place — Huntited" }, { name: "robots", content: "noindex" }],
  }),
  component: PlacePage,
});

const HEX = /^[0-9a-f]+$/;

function PlacePage() {
  const { hunt: huntId, key, inbox } = Route.useParams();
  const { t, date } = useI18n();
  const valid =
    /^[0-9a-f]{24}$/.test(huntId) &&
    key.length === 64 &&
    HEX.test(key) &&
    inbox.length === 64 &&
    HEX.test(inbox);
  const place = valid ? placePublic(key) : "";
  const [hunt, setHunt] = useState<ChainHuntView | null | undefined>();
  const [state, setState] = useState<{ registered: boolean; used: boolean } | null>(null);
  const [personal, setPersonal] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(() => (valid ? myPlaceRequest(huntId) : null));
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!valid) return;
    let cancelled = false;
    const load = async () => {
      const [h, places] = await Promise.all([
        getChainHunt(huntId).catch(() => null),
        getChainPlaces(huntId, [place]).catch(() => ({}) as Record<string, never>),
      ]);
      if (cancelled) return;
      setHunt(h);
      setState(places[place] ?? null);
    };
    void load();
    const timer = setInterval(() => void load(), 15_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [valid, huntId, place]);

  if (!valid) return <Message title={t("place.invalid")} />;
  if (hunt === undefined) return <Message title={t("common.loading")} />;
  if (!hunt || hunt.hidden) return <Message title={t("hunt.notFound.title")} />;

  const personalValue = personal.trim() ? Number(personal) : hunt.threshold;
  const personalValid = Number.isInteger(personalValue) && personalValue >= hunt.threshold;
  const open = hunt.commitsOpen;

  async function commit() {
    if (!hunt) return;
    setBusy(true);
    setError(false);
    const pool = createRelayPool(nostrRelays());
    try {
      const chat = ensureChatKey(huntId);
      const { event } = await sealPlaceRequest(
        huntId,
        key,
        inbox,
        {
          ...(personalValue !== hunt.threshold ? { threshold: personalValue } : {}),
          ...(chat ? { chat } : {}),
        },
        new Date(hunt.deadline).getTime(),
      );
      await pool.publish(event);
      rememberPlaceRequest(huntId, place);
      setSent(myPlaceRequest(huntId));
    } catch {
      setError(true);
    } finally {
      pool.close();
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{t("place.kicker")}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{hunt.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("place.meta", {
          threshold: hunt.threshold,
          date: date(hunt.deadline, { dateStyle: "long", timeStyle: "short" }),
        })}
      </p>
      <p className="mt-4 rounded-md border bg-muted/40 p-3 text-sm">{t("place.lead")}</p>

      <div className="mt-6 space-y-3 text-sm">
        {state?.used ? (
          <p role="status" className="font-medium text-green-700 dark:text-green-400">
            {t("place.done")}
          </p>
        ) : !state?.registered ? (
          <p className="text-muted-foreground">{t("place.notRegistered")}</p>
        ) : !open ? (
          <p className="text-muted-foreground">{t("place.closed")}</p>
        ) : sent ? (
          <p role="status">
            {t("place.sent", {
              date: date(sent.sentAt, { dateStyle: "medium", timeStyle: "short" }),
            })}
          </p>
        ) : (
          <>
            <label htmlFor="personal" className="flex flex-wrap items-center gap-2">
              <span>{t("commit.personal.before")}</span>
              <Input
                id="personal"
                type="number"
                min={hunt.threshold}
                placeholder={String(hunt.threshold)}
                value={personal}
                onChange={(e) => setPersonal(e.target.value)}
                className="h-8 w-24"
                aria-invalid={!personalValid}
                aria-label={`${t("commit.personal.before")} … ${t("commit.personal.after")}`}
              />
              <span>{t("commit.personal.after")}</span>
            </label>
            <label className="flex cursor-pointer items-start gap-3">
              <Checkbox
                aria-label={t("place.accept")}
                checked={accepted}
                onCheckedChange={(c) => setAccepted(c === true)}
                className="mt-0.5"
              />
              <span>
                {t("place.accept")}{" "}
                <Link to="/legal" hash="conditions" className="underline">
                  {t("commit.legalLink")}
                </Link>
              </span>
            </label>
            <Button onClick={() => void commit()} disabled={busy || !accepted || !personalValid}>
              {busy ? t("commit.submitting") : t("place.commit")}
            </Button>
          </>
        )}
        {error && (
          <p role="alert" className="text-destructive">
            {t("place.error")}
          </p>
        )}
        <Link to="/hunt/$id" params={{ id: huntId }} className="inline-block underline">
          {t("place.seeHunt")}
        </Link>
      </div>
    </div>
  );
}

function Message({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-10 text-sm text-muted-foreground">
      <p>{title}</p>
    </div>
  );
}
