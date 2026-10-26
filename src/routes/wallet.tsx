// « Mon wallet » : wallet Kaspa intégré (src/lib/builtin-wallet.ts, docs/wallet.md).
// Créer ou retrouver un wallet, recevoir des KAS (adresse, QR code, KAS de test
// gratuits, achat en euros), l'utiliser sur Huntited, sauvegarder sa phrase.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { qrSvg } from "@/lib/app-link";
import {
  builtinAddress,
  builtinBalance,
  builtinPhrase,
  createBuiltinWallet,
  hasBuiltinWallet,
  importBuiltinWallet,
  removeBuiltinWallet,
} from "@/lib/builtin-wallet";
import { REGISTRY_ADDRESS } from "@/lib/chain";
import { useI18n } from "@/lib/i18n";
import { connectBuiltin, disconnectWallet, getWalletState } from "@/lib/wallet";

export const Route = createFileRoute("/wallet")({
  head: () => ({ meta: [{ title: "Mon wallet — Huntited" }] }),
  component: WalletPage,
});

const TESTNET = REGISTRY_ADDRESS.startsWith("kaspatest:");
const FAUCET = "https://faucet-tn10.kaspanet.io/";
/** Service d'achat en euros (réseau principal), choisi au lancement : VITE_ONRAMP_URL. */
const ONRAMP = (import.meta.env["VITE_ONRAMP_URL"] as string | undefined)?.trim() || null;

const kas = (sompi: bigint) =>
  (Number(sompi) / 1e8).toLocaleString(undefined, { maximumFractionDigits: 4 });

function WalletPage() {
  const { t } = useI18n();
  const [exists, setExists] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);
  useEffect(() => setExists(hasBuiltinWallet()), []);

  return (
    <div className="mx-auto max-w-xl space-y-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("wallet.page.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("wallet.page.lead")}</p>
        {TESTNET && (
          <p className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            {t("wallet.page.testnet")}
          </p>
        )}
      </div>

      {fresh ? (
        <Backup
          phrase={fresh}
          onDone={() => {
            setFresh(null);
            setExists(true);
          }}
        />
      ) : exists ? (
        <MyWallet onRemoved={() => setExists(false)} />
      ) : (
        <Start
          onCreated={(phrase) => setFresh(phrase)}
          onImported={() => {
            connectBuiltin();
            setExists(true);
          }}
        />
      )}
    </div>
  );
}

/** Pas encore de wallet : en créer un, ou le retrouver avec sa phrase. */
function Start({
  onCreated,
  onImported,
}: {
  onCreated: (phrase: string) => void;
  onImported: () => void;
}) {
  const { t } = useI18n();
  const [importing, setImporting] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [bad, setBad] = useState(false);

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4 text-sm">
      <Button className="w-full" onClick={() => onCreated(createBuiltinWallet())}>
        {t("wallet.page.create")}
      </Button>
      <p className="text-xs text-muted-foreground">{t("wallet.page.createNote")}</p>
      {importing ? (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (importBuiltinWallet(phrase)) onImported();
            else setBad(true);
          }}
        >
          <label htmlFor="phrase" className="text-xs font-medium">
            {t("wallet.page.importLabel")}
          </label>
          <Textarea
            id="phrase"
            value={phrase}
            onChange={(e) => {
              setPhrase(e.target.value);
              setBad(false);
            }}
            autoComplete="off"
            spellCheck={false}
            rows={3}
          />
          {bad && (
            <p role="alert" className="text-xs text-destructive">
              {t("wallet.page.importBad")}
            </p>
          )}
          <Button type="submit" variant="outline" size="sm">
            {t("wallet.page.import")}
          </Button>
        </form>
      ) : (
        <button type="button" className="text-xs underline" onClick={() => setImporting(true)}>
          {t("wallet.page.haveOne")}
        </button>
      )}
    </div>
  );
}

/** Juste créé : noter la phrase avant de continuer. */
function Backup({ phrase, onDone }: { phrase: string; onDone: () => void }) {
  const { t } = useI18n();
  const [noted, setNoted] = useState(false);
  return (
    <div className="space-y-4 rounded-lg border bg-card p-4 text-sm">
      <h2 className="font-semibold">{t("wallet.page.backupTitle")}</h2>
      <p className="text-muted-foreground">{t("wallet.page.backupLead")}</p>
      <ol className="grid grid-cols-2 gap-2 font-mono text-sm sm:grid-cols-3">
        {phrase.split(" ").map((w, i) => (
          <li key={i} className="rounded border px-2 py-1">
            <span className="text-muted-foreground">{i + 1}.</span> {w}
          </li>
        ))}
      </ol>
      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={noted}
          onChange={(e) => setNoted(e.target.checked)}
          className="mt-0.5"
        />
        <span>{t("wallet.page.backupNoted")}</span>
      </label>
      <Button
        disabled={!noted}
        onClick={() => {
          connectBuiltin();
          onDone();
        }}
      >
        {t("wallet.page.backupDone")}
      </Button>
    </div>
  );
}

/** Le wallet : adresse, solde, recevoir, utiliser, sauvegarder, retirer. */
function MyWallet({ onRemoved }: { onRemoved: () => void }) {
  const { t } = useI18n();
  const address = builtinAddress(TESTNET ? "kaspatest" : "kaspa")!;
  const [balance, setBalance] = useState<bigint | null>(null);
  const [balanceError, setBalanceError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showPhrase, setShowPhrase] = useState(false);
  const [inUse, setInUse] = useState(false);

  const refresh = () => {
    setBalanceError(false);
    void builtinBalance(address)
      .then(setBalance)
      .catch(() => setBalanceError(true));
  };
  useEffect(() => {
    refresh();
    const s = getWalletState();
    setInUse(s.isConnected && s.kind === "builtin");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  const copy = () =>
    void navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-lg border bg-card p-4 text-sm">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-semibold">{t("wallet.page.balance")}</h2>
          <button type="button" className="text-xs underline" onClick={refresh}>
            {t("wallet.page.refresh")}
          </button>
        </div>
        <p className="text-2xl font-semibold" aria-live="polite">
          {balanceError ? (
            <span className="text-sm font-normal text-destructive">{t("wallet.err.node")}</span>
          ) : balance === null ? (
            "…"
          ) : (
            `${kas(balance)} ${TESTNET ? "TKAS" : "KAS"}`
          )}
        </p>
        {inUse ? (
          <p className="text-xs text-muted-foreground">
            {t("wallet.page.inUse")}{" "}
            <Link to="/" className="underline">
              {t("wallet.page.seeHunts")}
            </Link>
          </p>
        ) : (
          <Button
            size="sm"
            onClick={() => {
              connectBuiltin();
              setInUse(true);
            }}
          >
            {t("wallet.page.use")}
          </Button>
        )}
      </section>

      <section className="space-y-3 rounded-lg border bg-card p-4 text-sm">
        <h2 className="font-semibold">{t("wallet.page.receive")}</h2>
        <div
          className="mx-auto w-44 rounded bg-white p-2"
          role="img"
          aria-label={t("wallet.page.qr")}
          dangerouslySetInnerHTML={{ __html: qrSvg(address) }}
        />
        <p className="break-all text-center font-mono text-xs">{address}</p>
        <Button variant="outline" size="sm" className="w-full" onClick={copy}>
          {copied ? t("chatLogin.copied") : t("wallet.page.copy")}
        </Button>
        {TESTNET ? (
          <div className="space-y-2">
            <Button
              className="w-full"
              onClick={() => {
                copy();
                window.open(FAUCET, "_blank", "noopener");
              }}
            >
              {t("wallet.page.faucet")}
            </Button>
            <p className="text-xs text-muted-foreground">{t("wallet.page.faucetNote")}</p>
          </div>
        ) : null}
        <div className="space-y-2 border-t pt-3">
          <h3 className="font-medium">{t("wallet.page.buyTitle")}</h3>
          {!TESTNET && ONRAMP ? (
            <Button
              className="w-full"
              onClick={() => {
                copy();
                window.open(ONRAMP, "_blank", "noopener");
              }}
            >
              {t("wallet.page.buy")}
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">{t("wallet.page.buyLater")}</p>
          )}
          <p className="text-xs text-muted-foreground">{t("wallet.page.buyNote")}</p>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border bg-card p-4 text-sm">
        <h2 className="font-semibold">{t("wallet.page.safety")}</h2>
        <p className="text-xs text-muted-foreground">{t("wallet.page.safetyNote")}</p>
        {showPhrase ? (
          <p className="rounded border bg-muted p-2 font-mono text-xs">{builtinPhrase()}</p>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.confirm(t("wallet.page.showConfirm")) && setShowPhrase(true)}
          >
            {t("wallet.page.show")}
          </Button>
        )}
        <div>
          <button
            type="button"
            className="text-xs text-destructive underline"
            onClick={() => {
              if (!window.confirm(t("wallet.page.removeConfirm"))) return;
              if (getWalletState().kind === "builtin") disconnectWallet();
              removeBuiltinWallet();
              onRemoved();
            }}
          >
            {t("wallet.page.remove")}
          </button>
        </div>
      </section>
    </div>
  );
}
