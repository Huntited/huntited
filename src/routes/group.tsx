// Pass d'organisation (syndicats, associations, collectifs ; docs/pass-groupe.md) :
// créer l'organisation et ses adhérents (un lien personnel permanent chacun),
// ouvrir des chasses aux adhérents, puis inscrire par lots leurs engagements.
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { publish } from "@/lib/chain";
import {
  groupTopic,
  openPlaceRequest,
  placePublic,
  PLACE_REQUEST_KIND,
  type Group,
} from "@/lib/group-pass";
import { useI18n } from "@/lib/i18n";
import { huntIdFrom } from "@/lib/moderation";
import { createRelayPool, nostrRelays } from "@/lib/nostr-relays";
import { getChainHunt, getChainPlaces } from "@/lib/onchain/browser-index";
import {
  MAX_GROUP_COMMITS_PER_MESSAGE,
  MAX_PLACES_PER_MESSAGE,
  type GroupCommitEntry,
} from "@/lib/onchain/protocol";
import {
  addMembers,
  createOrg,
  exportOrg,
  importOrg,
  memberLink,
  openHunt,
  orgGroup,
  orgs,
  type Org,
} from "@/lib/org-pass";
import { chatPublicKey } from "@/lib/p2p-chat";
import { useWallet } from "@/lib/useWallet";
import { WalletError } from "@/lib/wallet";

export const Route = createFileRoute("/group")({
  validateSearch: (s: Record<string, unknown>): { hunt?: string } =>
    typeof s["hunt"] === "string" ? { hunt: s["hunt"] } : {},
  head: () => ({ meta: [{ title: "Pass d'organisation — Huntited" }] }),
  component: OrgPage,
});

function OrgPage() {
  const { t } = useI18n();
  const search = Route.useSearch();
  const [list, setList] = useState<Org[]>([]);
  const [name, setName] = useState("");
  const [count, setCount] = useState("20");
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => setList(orgs()), []);
  const refresh = () => setList(orgs());

  function restore(file: File) {
    void file.text().then((text) => {
      setMessage(importOrg(text) ? null : t("group.badBackup"));
      refresh();
    });
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{t("org.title")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("org.lead")}</p>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
        <li>{t("org.step1")}</li>
        <li>{t("org.step2")}</li>
        <li>{t("org.step3")}</li>
      </ol>

      {list.length === 0 && (
        <form
          className="mt-6 space-y-3 rounded-lg border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            const n = Number(count);
            if (!Number.isInteger(n) || n < 1) return setMessage(t("group.invalid"));
            createOrg(name, n);
            refresh();
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="org-name">{t("org.name")}</Label>
            <Input id="org-name" value={name} onChange={(e) => setName(e.target.value)} />
            <p className="text-xs text-muted-foreground">{t("org.nameNote")}</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="org-count">{t("org.count")}</Label>
            <Input
              id="org-count"
              type="number"
              min={1}
              max={2000}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              className="w-32"
            />
          </div>
          <Button type="submit">{t("org.create")}</Button>
        </form>
      )}
      {message && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {message}
        </p>
      )}

      {list.map((o) => (
        <OrgCard key={o.id} org={o} onChange={refresh} prefill={search.hunt ?? ""} />
      ))}

      <p className="mt-8 text-xs text-muted-foreground">
        <label className="cursor-pointer underline">
          {t("group.restore")}
          <input
            type="file"
            accept="application/json"
            className="sr-only"
            onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])}
          />
        </label>
      </p>
    </div>
  );
}

function OrgCard({ org, onChange, prefill }: { org: Org; onChange: () => void; prefill: string }) {
  const { t } = useI18n();
  const [target, setTarget] = useState(prefill);
  const [more, setMore] = useState("10");
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const base = typeof window === "undefined" ? "" : window.location.href.split("#")[0]!;
  const links = org.members.map((m) => `${m.label} : ${memberLink(base, org, m)}`);

  async function open() {
    setMessage(null);
    const id = huntIdFrom(target);
    if (!id) return setMessage(t("group.invalid"));
    const h = await getChainHunt(id).catch(() => null);
    if (!h || h.hidden) return setMessage(t("hunt.notFound.title"));
    if (!h.commitsOpen) return setMessage(t("place.closed"));
    openHunt(org, id, h.title);
    setTarget("");
    onChange();
  }

  function download() {
    const url = URL.createObjectURL(new Blob([exportOrg(org)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `huntited-organisation-${org.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="mt-8 space-y-4 rounded-lg border bg-card p-4 text-sm">
      <div>
        <h2 className="text-base font-semibold">{org.name}</h2>
        <p className="text-muted-foreground">{t("org.members", { n: org.members.length })}</p>
      </div>

      <details>
        <summary className="cursor-pointer font-medium">
          {t("org.links", { n: links.length })}
        </summary>
        <p className="mt-2 text-xs text-muted-foreground">{t("org.linksNote")}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              void navigator.clipboard.writeText(links.join("\n")).then(() => setCopied(true))
            }
          >
            {copied ? t("chatLogin.copied") : t("group.copyAll")}
          </Button>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              addMembers(org, Number(more));
              onChange();
            }}
          >
            <Input
              type="number"
              min={1}
              value={more}
              onChange={(e) => setMore(e.target.value)}
              className="h-8 w-20"
              aria-label={t("org.addCount")}
            />
            <Button size="sm" variant="outline" type="submit">
              {t("org.add")}
            </Button>
          </form>
        </div>
        <ol className="mt-2 max-h-60 space-y-1 overflow-y-auto font-mono text-[11px]">
          {links.map((l) => (
            <li key={l} className="break-all">
              {l}
            </li>
          ))}
        </ol>
      </details>

      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          void open();
        }}
      >
        <Label htmlFor={`open-${org.id}`}>{t("org.openHunt")}</Label>
        <div className="flex gap-2">
          <Input
            id={`open-${org.id}`}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="https://huntited.com/#/hunt/…"
          />
          <Button type="submit" size="sm">
            {t("org.open")}
          </Button>
        </div>
        {message && (
          <p role="alert" className="text-xs text-destructive">
            {message}
          </p>
        )}
      </form>

      {org.hunts.map((h) => (
        <HuntBatch key={h.hunt} group={orgGroup(org, h.hunt, h.title)} />
      ))}

      <p className="text-xs text-muted-foreground">
        <button type="button" className="underline" onClick={download}>
          {t("group.backup")}
        </button>{" "}
        · {t("org.backupNote")}
      </p>
    </section>
  );
}

/** Une chasse ouverte aux adhérents : inscrire les places, puis les engagements reçus. */
function HuntBatch({ group: g }: { group: Group }) {
  const { t } = useI18n();
  const wallet = useWallet();
  const pubs = g.places.map(placePublic);
  const [state, setState] = useState<Record<string, { registered: boolean; used: boolean }>>({});
  const [requests, setRequests] = useState<Record<string, GroupCommitEntry>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      void getChainPlaces(g.hunt, pubs)
        .then((s) => !cancelled && setState(s))
        .catch(() => undefined);
    load();
    const timer = setInterval(load, 15_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g.hunt, pubs.length]);

  useEffect(() => {
    const pool = createRelayPool(nostrRelays());
    const stop = pool.subscribe(
      { kinds: [PLACE_REQUEST_KIND], "#h": [groupTopic(chatPublicKey(g.inbox))] },
      (e) =>
        void openPlaceRequest(g, e).then(
          (entry) => entry && setRequests((all) => ({ ...all, [entry.place]: entry })),
        ),
    );
    return () => {
      stop();
      pool.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g.hunt, g.places.length]);

  const unregistered = pubs.filter((p) => !state[p]?.registered);
  const used = pubs.filter((p) => state[p]?.used).length;
  const pending = Object.values(requests).filter(
    (r) => state[r.place]?.registered && !state[r.place]?.used,
  );

  async function send(m: Parameters<typeof publish>[0]) {
    setBusy(true);
    setMessage(null);
    try {
      await publish(m);
      setMessage(t("group.sent"));
    } catch (e) {
      setMessage(e instanceof WalletError ? e.message : t("err.unavailable"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 rounded-md border p-3">
      <p className="font-medium">{g.title}</p>
      <p className="text-xs text-muted-foreground">
        {t("group.status", {
          total: pubs.length,
          registered: pubs.length - unregistered.length,
          used,
        })}
      </p>
      {!wallet.isConnected ? (
        <Button variant="outline" size="sm" onClick={() => void wallet.connectWallet()}>
          {t("wallet.connect")}
        </Button>
      ) : (
        <div className="flex flex-wrap gap-2">
          {unregistered.length > 0 && (
            <Button
              size="sm"
              disabled={busy}
              onClick={() =>
                void send({
                  t: "places",
                  hunt: g.hunt,
                  keys: unregistered.slice(0, MAX_PLACES_PER_MESSAGE),
                })
              }
            >
              {t("group.register", { n: Math.min(unregistered.length, MAX_PLACES_PER_MESSAGE) })}
            </Button>
          )}
          {pending.length > 0 && (
            <Button
              size="sm"
              disabled={busy}
              onClick={() =>
                void send({
                  t: "gcommit",
                  hunt: g.hunt,
                  entries: pending
                    .slice(0, MAX_GROUP_COMMITS_PER_MESSAGE)
                    .map(({ place, sig, threshold, chat }) => ({
                      place,
                      sig,
                      ...(threshold === undefined ? {} : { threshold }),
                      ...(chat === undefined ? {} : { chat }),
                    })),
                })
              }
            >
              {t("group.batch", { n: Math.min(pending.length, MAX_GROUP_COMMITS_PER_MESSAGE) })}
            </Button>
          )}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {pending.length > 0 ? t("group.pending", { n: pending.length }) : t("group.noPending")}
      </p>
      {message && (
        <p role="status" className="text-xs">
          {message}
        </p>
      )}
    </div>
  );
}
