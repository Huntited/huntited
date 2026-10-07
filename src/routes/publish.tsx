import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { publish } from "@/lib/chain";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { getChainReleases, releasePublishers } from "@/lib/onchain/browser-index";
import {
  OFFICIAL_DOMAIN,
  OFFICIAL_MAINNET_ADDRESS,
  OFFICIAL_PUBLISHER,
} from "@/lib/onchain/publisher";
import type { LedgerRelease } from "@/lib/onchain/ledger";
import { checkRelease, loadReleaseInfo, type ReleaseInfo, type ReleaseStatus } from "@/lib/release";
import { useWallet } from "@/lib/useWallet";
import { WalletError } from "@/lib/wallet";

export const Route = createFileRoute("/publish")({
  head: () => ({ meta: [{ title: "Versions — Huntited" }] }),
  component: PublishPage,
});

const STATUS: Record<ReleaseStatus, MessageKey> = {
  verified: "release.verified",
  mismatch: "release.mismatch",
  unanchored: "release.unanchored",
};

/**
 * Versions officielles du site, ancrées sur Kaspa, et ancrage de la version
 * actuelle (seulement depuis l'adresse de publication).
 */
function PublishPage() {
  const { t, date } = useI18n();
  const wallet = useWallet();
  const [info, setInfo] = useState<ReleaseInfo | null | undefined>();
  const [status, setStatus] = useState<ReleaseStatus | null>(null);
  const [releases, setReleases] = useState<LedgerRelease[] | null>(null);
  const [cid, setCid] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const publishers = releasePublishers();
  const isPublisher = !!wallet.address && publishers.includes(wallet.address);

  useEffect(() => {
    void loadReleaseInfo().then(setInfo);
    void getChainReleases()
      .then(setReleases)
      .catch(() => setReleases([]));
  }, []);
  useEffect(() => {
    if (info)
      void checkRelease(info)
        .then(setStatus)
        .catch(() => undefined);
  }, [info, releases]);

  async function anchor() {
    if (!info) return;
    setBusy(true);
    setMessage(null);
    try {
      await publish({
        t: "release",
        version: info.version,
        manifest: info.manifest,
        ...(cid.trim() ? { cid: cid.trim() } : {}),
      });
      setMessage(t("release.sent"));
    } catch (e) {
      setMessage(e instanceof WalletError ? e.message : t("err.unavailable"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{t("release.title")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("release.lead")}</p>
      {publishers.includes(OFFICIAL_PUBLISHER) && (
        <p className="mt-2 text-sm text-muted-foreground">
          {t("release.official", { domain: OFFICIAL_DOMAIN })}{" "}
          <span className="break-all font-mono text-xs">{OFFICIAL_MAINNET_ADDRESS}</span>
        </p>
      )}

      <section aria-labelledby="this-title" className="mt-8 space-y-1 text-sm">
        <h2 id="this-title" className="font-semibold">
          {t("release.this")}
        </h2>
        {info === undefined ? (
          <p className="text-muted-foreground">{t("common.loading")}</p>
        ) : info === null ? (
          <p className="text-muted-foreground">{t("release.noManifest")}</p>
        ) : (
          <>
            <p>{t("release.version", { version: info.version })}</p>
            <p className="break-all font-mono text-xs text-muted-foreground">{info.manifest}</p>
            {status && (
              <p className={status === "mismatch" ? "text-destructive" : ""}>{t(STATUS[status])}</p>
            )}
          </>
        )}
      </section>

      <section aria-labelledby="list-title" className="mt-8">
        <h2 id="list-title" className="font-semibold">
          {t("release.list")}
        </h2>
        {releases === null ? (
          <p className="mt-2 text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : releases.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t("release.none")}</p>
        ) : (
          <ul className="mt-2 divide-y border-y text-sm">
            {[...releases].reverse().map((r) => (
              <li key={r.txId} className="py-2">
                <p className="font-medium">
                  {r.version}{" "}
                  <span className="font-normal text-muted-foreground">
                    · {date(new Date(r.at).toISOString(), { dateStyle: "medium" })}
                  </span>
                </p>
                <p className="break-all font-mono text-xs text-muted-foreground">{r.manifest}</p>
                {r.cid && <p className="break-all font-mono text-xs">IPFS : {r.cid}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {info && (
        <section aria-labelledby="anchor-title" className="mt-8 space-y-3">
          <h2 id="anchor-title" className="font-semibold">
            {t("release.anchor")}
          </h2>
          {publishers.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("release.noPublisher")}</p>
          ) : !wallet.isConnected ? (
            <Button variant="outline" onClick={() => void wallet.connectWallet()}>
              {t("wallet.connect")}
            </Button>
          ) : !isPublisher ? (
            <p className="text-sm text-muted-foreground">{t("release.notPublisher")}</p>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="cid">{t("release.cid")}</Label>
                <Input
                  id="cid"
                  value={cid}
                  onChange={(e) => setCid(e.target.value)}
                  placeholder="bafy…"
                />
              </div>
              <Button onClick={() => void anchor()} disabled={busy || status === "verified"}>
                {t("release.anchorButton", { version: info.version })}
              </Button>
            </>
          )}
          {message && (
            <p role="status" className="text-sm">
              {message}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
