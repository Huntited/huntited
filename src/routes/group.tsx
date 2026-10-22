// Pass de groupe, côté association (docs/pass-groupe.md) : créer des places
// pour une chasse, les inscrire sur la blockchain, distribuer les liens,
// puis inscrire par lots les engagements reçus des membres.
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { publish } from "@/lib/chain";
import {
  createGroup,
  exportGroup,
  groups,
  groupTopic,
  importGroup,
  openPlaceRequest,
  placeLink,
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
import { chatPublicKey } from "@/lib/p2p-chat";
import { useWallet } from "@/lib/useWallet";
import { WalletError } from "@/lib/wallet";

export const Route = createFileRoute("/group")({
  validateSearch: (s: Record<string, unknown>): { hunt?: string } =>
    typeof s["hunt"] === "string" ? { hunt: s["hunt"] } : {},
  head: () => ({ meta: [{ title: "Pass de groupe — Huntited" }] }),
  component: GroupPage,
});

function GroupPage() {
  const { t } = useI18n();
  const search = Route.useSearch();
  const [list, setList] = useState<Group[]>([]);
  const [target, setTarget] = useState(search.hunt ?? "");
  const [count, setCount] = useState("10");
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => setList(groups()), []);

  async function create() {
    setMessage(null);
    const id = huntIdFrom(target);
    const n = Number(count);
    if (!id || !Number.isInteger(n) || n < 1) return setMessage(t("group.invalid"));
    const h = await getChainHunt(id).catch(() => null);
    if (!h || h.hidden) return setMessage(t("hunt.notFound.title"));
    if (!h.commitsOpen) return setMessage(t("place.closed"));
    createGroup(id, h.title, n);
    setList(groups());
    setTarget("");
  }

  function restore(file: File) {
    void file.text().then((text) => {
      setMessage(importGroup(text) ? null : t("group.badBackup"));
      setList(groups());
    });
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{t("group.title")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("group.lead")}</p>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
        <li>{t("group.step1")}</li>
        <li>{t("group.step2")}</li>
        <li>{t("group.step3")}</li>
      </ol>

      <form
        className="mt-6 space-y-3 rounded-lg border p-4"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <div className="space-y-1">
          <Label htmlFor="group-hunt">{t("moderation.target")}</Label>
          <Input id="group-hunt" value={target} onChange={(e) => setTarget(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="group-count">{t("group.count")}</Label>
          <Input
            id="group-count"
            type="number"
            min={1}
            max={500}
            value={count}
            onChange={(e) => setCount(e.target.value)}
            className="w-32"
          />
        </div>
        <Button type="submit">{t("group.create")}</Button>
        <p className="text-xs text-muted-foreground">{t("group.cost")}</p>
      </form>
      {message && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {message}
        </p>
      )}

      {list.map((g) => (
        <GroupCard key={g.hunt} group={g} />
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

function GroupCard({ group: g }: { group: Group }) {
  const { t } = useI18n();
  const wallet = useWallet();
  const pubs = g.places.map(placePublic);
  const [state, setState] = useState<Record<string, { registered: boolean; used: boolean }>>({});
  const [requests, setRequests] = useState<Record<string, GroupCommitEntry>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // État des places sur la chaîne (relu toutes les 15 s).
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

  // Demandes des membres, lues dans la boîte de réception (relais Nostr).
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
  const base = typeof window === "undefined" ? "" : window.location.href.split("#")[0]!;
  const links = g.places.map((k) => placeLink(base, g, k));

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

  function download() {
    const url = URL.createObjectURL(new Blob([exportGroup(g)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `huntited-groupe-${g.hunt}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="mt-8 space-y-3 rounded-lg border bg-card p-4 text-sm">
      <h2 className="font-semibold">{g.title}</h2>
      <p className="text-muted-foreground">
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
                  entries: pending.slice(0, MAX_GROUP_COMMITS_PER_MESSAGE),
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

      <details>
        <summary className="cursor-pointer font-medium">
          {t("group.links", { n: links.length })}
        </summary>
        <p className="mt-2 text-xs text-muted-foreground">{t("group.linksNote")}</p>
        <Button
          size="sm"
          variant="outline"
          className="mt-2"
          onClick={() =>
            void navigator.clipboard.writeText(links.join("\n")).then(() => setCopied(true))
          }
        >
          {copied ? t("chatLogin.copied") : t("group.copyAll")}
        </Button>
        <ol className="mt-2 max-h-60 list-decimal space-y-1 overflow-y-auto pl-5 font-mono text-[11px]">
          {links.map((l, i) => (
            <li key={l} className="break-all">
              {l}
              {state[pubs[i]!]?.used ? " ✓" : ""}
            </li>
          ))}
        </ol>
      </details>

      <p className="text-xs text-muted-foreground">
        <button type="button" className="underline" onClick={download}>
          {t("group.backup")}
        </button>{" "}
        · {t("group.backupNote")}
      </p>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </section>
  );
}
