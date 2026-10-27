// « Mon wallet » : wallet Kaspa intégré (src/lib/builtin-wallet.ts, docs/wallet.md).
// Créer ou retrouver un wallet, recevoir des KAS (adresse, QR code, KAS de test
// gratuits, achat en euros), l'utiliser sur Huntited, le protéger (code,
// empreinte), sauvegarder sa phrase.
import { createFileRoute, Link } from "@tanstack/react-router";
import { Fingerprint, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { qrSvg } from "@/lib/app-link";
import {
  bioProtectionAvailable,
  builtinAddress,
  builtinBalance,
  builtinPhrase,
  builtinProtection,
  createBuiltinWallet,
  hasBuiltinWallet,
  importBuiltinWallet,
  isLocked,
  lockBuiltin,
  protectBuiltin,
  removeBuiltinWallet,
  type CodeKind,
  type Protection,
} from "@/lib/builtin-wallet";
import { REGISTRY_ADDRESS } from "@/lib/chain";
import { useI18n, type MessageKey } from "@/lib/i18n";
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

const LOCK_CHOICES: { ms: number; key: MessageKey }[] = [
  { ms: 0, key: "wallet.lock.each" },
  { ms: 5 * 60_000, key: "wallet.lock.5min" },
  { ms: 30 * 60_000, key: "wallet.lock.30min" },
  { ms: -1, key: "wallet.lock.page" },
];

/**
 * Protection du wallet : code (chiffres ou mot de passe), empreinte ou visage
 * (app), ou les deux ; quand reverrouiller ; effacement après trop d'erreurs.
 */
function ProtectionSection() {
  const { t } = useI18n();
  const [current, setCurrent] = useState<Protection | null>(null);
  const [useCode, setUseCode] = useState(false);
  const [kind, setKind] = useState<CodeKind>("pin");
  const [code, setCode] = useState("");
  const [confirm, setConfirm] = useState("");
  const [bio, setBio] = useState(false);
  const [lockAfter, setLockAfter] = useState(5 * 60_000);
  const [wipe, setWipe] = useState(false);
  const [message, setMessage] = useState<{ key: MessageKey; error: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [bioOk, setBioOk] = useState(false);

  const load = () => {
    const p = builtinProtection();
    setCurrent(p);
    setUseCode(p?.code != null);
    setKind(p?.code ?? "pin");
    setBio(p?.bio ?? false);
    setLockAfter(p && (p.code || p.bio) ? p.lockAfterMs : 5 * 60_000);
    setWipe((p?.wipeAfter ?? 0) > 0);
  };
  useEffect(() => {
    load();
    setBioOk(bioProtectionAvailable());
  }, []);

  const protectedNow = current != null && (current.code != null || current.bio);
  const minLen = kind === "pin" ? 6 : 8;
  const codeValid =
    !useCode ||
    (code.length >= minLen && code === confirm && (kind === "password" || /^\d+$/.test(code)));

  async function save() {
    setMessage(null);
    if (!codeValid) return setMessage({ key: "wallet.lock.invalid", error: true });
    setBusy(true);
    try {
      await protectBuiltin({
        code: useCode ? code : null,
        codeKind: kind,
        bio,
        lockAfterMs: lockAfter,
        wipeAfter: wipe ? 10 : 0,
      });
      setCode("");
      setConfirm("");
      load();
      setMessage({
        key: useCode || bio ? "wallet.lock.saved" : "wallet.lock.removed",
        error: false,
      });
    } catch {
      setMessage({ key: "wallet.lock.failed", error: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 rounded-lg border bg-card p-4 text-sm">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-1.5 font-semibold">
          <ShieldCheck className="size-4" aria-hidden />
          {t("wallet.lock.title")}
        </h2>
        {protectedNow && !isLocked() && (
          <button
            type="button"
            className="text-xs underline"
            onClick={() => {
              lockBuiltin();
              setMessage({ key: "wallet.lock.locked", error: false });
            }}
          >
            {t("wallet.lock.lockNow")}
          </button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {t(
          !protectedNow
            ? "wallet.lock.none"
            : current?.code && current.bio
              ? "wallet.lock.isBoth"
              : current?.bio
                ? "wallet.lock.isBio"
                : "wallet.lock.isCode",
        )}
      </p>

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) void save();
        }}
      >
        <fieldset className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={useCode}
              onChange={(e) => setUseCode(e.target.checked)}
            />
            <span>{t("wallet.lock.useCode")}</span>
          </label>
          {useCode && (
            <div className="space-y-2 pl-6">
              <div className="flex flex-wrap gap-3 text-xs">
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    name="kind"
                    checked={kind === "pin"}
                    onChange={() => setKind("pin")}
                  />
                  {t("wallet.lock.kindPin")}
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    name="kind"
                    checked={kind === "password"}
                    onChange={() => setKind("password")}
                  />
                  {t("wallet.lock.kindPassword")}
                </label>
              </div>
              <Input
                type="password"
                inputMode={kind === "pin" ? "numeric" : "text"}
                autoComplete="new-password"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={t(kind === "pin" ? "wallet.lock.pin" : "wallet.lock.password")}
                aria-label={t(kind === "pin" ? "wallet.lock.pin" : "wallet.lock.password")}
              />
              <Input
                type="password"
                inputMode={kind === "pin" ? "numeric" : "text"}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder={t("wallet.lock.confirm")}
                aria-label={t("wallet.lock.confirm")}
              />
              <p className="text-xs text-muted-foreground">
                {t(kind === "pin" ? "wallet.lock.pinHint" : "wallet.lock.passwordHint")}
              </p>
              <label className="flex items-start gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={wipe}
                  onChange={(e) => setWipe(e.target.checked)}
                  className="mt-0.5"
                />
                <span>{t("wallet.lock.wipe")}</span>
              </label>
            </div>
          )}
          <label className={`flex items-center gap-2 ${bioOk ? "" : "opacity-60"}`}>
            <input
              type="checkbox"
              checked={bio}
              disabled={!bioOk}
              onChange={(e) => setBio(e.target.checked)}
            />
            <span className="flex items-center gap-1">
              <Fingerprint className="size-4" aria-hidden />
              {t("wallet.lock.useBio")}
            </span>
          </label>
          {!bioOk && (
            <p className="pl-6 text-xs text-muted-foreground">{t("wallet.lock.bioApp")}</p>
          )}
        </fieldset>

        {(useCode || bio) && (
          <div className="space-y-1">
            <label htmlFor="lock-after" className="text-xs font-medium">
              {t("wallet.lock.when")}
            </label>
            <select
              id="lock-after"
              value={lockAfter}
              onChange={(e) => setLockAfter(Number(e.target.value))}
              className="h-9 w-full rounded-md border bg-background px-2"
            >
              {LOCK_CHOICES.map((c) => (
                <option key={c.ms} value={c.ms}>
                  {t(c.key)}
                </option>
              ))}
            </select>
          </div>
        )}

        {useCode && kind === "pin" && (
          <p className="text-xs text-muted-foreground">{t("wallet.lock.pinWarning")}</p>
        )}
        {message && (
          <p
            role={message.error ? "alert" : "status"}
            className={`text-xs ${message.error ? "text-destructive" : "text-muted-foreground"}`}
          >
            {t(message.key)}
          </p>
        )}
        <Button type="submit" size="sm" disabled={busy || !codeValid}>
          {busy ? t("wallet.unlock.busy") : t("wallet.lock.save")}
        </Button>
      </form>
    </section>
  );
}

/** Le wallet : adresse, solde, recevoir, utiliser, sauvegarder, retirer. */
function MyWallet({ onRemoved }: { onRemoved: () => void }) {
  const { t } = useI18n();
  const address = builtinAddress(TESTNET ? "kaspatest" : "kaspa")!;
  const [balance, setBalance] = useState<bigint | null>(null);
  const [balanceError, setBalanceError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shownPhrase, setShownPhrase] = useState<string | null>(null);
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

      <ProtectionSection />

      <section className="space-y-3 rounded-lg border bg-card p-4 text-sm">
        <h2 className="font-semibold">{t("wallet.page.safety")}</h2>
        <p className="text-xs text-muted-foreground">{t("wallet.page.safetyNote")}</p>
        {shownPhrase ? (
          <p className="rounded border bg-muted p-2 font-mono text-xs">{shownPhrase}</p>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (!window.confirm(t("wallet.page.showConfirm"))) return;
              void builtinPhrase()
                .then((p) => {
                  setShownPhrase(p);
                  // Masquée de nouveau après 30 s.
                  setTimeout(() => setShownPhrase(null), 30_000);
                })
                .catch(() => undefined);
            }}
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
