// « Mon wallet » : wallet Kaspa intégré (src/lib/builtin-wallet.ts, docs/wallet.md).
// Créer ou retrouver un wallet, recevoir des KAS (adresse, QR code, KAS de test
// gratuits, achat en euros), l'utiliser sur Huntited, le protéger (code,
// empreinte), sauvegarder sa phrase.
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ChevronDown,
  CircleCheck,
  ExternalLink,
  Fingerprint,
  KeyRound,
  Lock,
  RefreshCw,
  ShieldCheck,
  ShoppingCart,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

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
  isProtected,
  lockBuiltin,
  protectBuiltin,
  removeBuiltinWallet,
  unlockForPage,
  type CodeKind,
  type Protection,
} from "@/lib/builtin-wallet";
import { REGISTRY_ADDRESS } from "@/lib/chain";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { connectBuiltin, disconnectWallet, getWalletState, subscribeWallet } from "@/lib/wallet";

export const Route = createFileRoute("/wallet")({
  head: () => ({ meta: [{ title: "Mon wallet — Huntited" }] }),
  component: WalletPage,
});

const TESTNET = REGISTRY_ADDRESS.startsWith("kaspatest:");
const FAUCET = "https://faucet-tn10.kaspanet.io/";
/** Service d'achat en euros (réseau principal), choisi au lancement : VITE_ONRAMP_URL. */
const ONRAMP = (import.meta.env["VITE_ONRAMP_URL"] as string | undefined)?.trim() || null;
/** Échange d'autres cryptomonnaies contre des KAS, sans compte (réseau principal). */
const CHANGENOW = "https://changenow.io/currencies/kaspa";
/** Achat de KAS en euros (réseau principal), comme dans « Connecter un wallet ». */
const SHOPS = [
  { name: "Deskoin", note: "picker.deskoin", href: "https://deskoin.com/en/acheter/kaspa" },
  { name: "Kraken", note: "picker.kraken", href: "https://www.kraken.com/buy/kas" },
] as const;

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
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{t("wallet.page.title")}</h1>
          {TESTNET && (
            <span
              className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
              title={t("wallet.page.testnet")}
            >
              {t("wallet.page.testnetTag")}
            </span>
          )}
        </div>
        {!exists && <p className="mt-2 text-sm text-muted-foreground">{t("wallet.page.lead")}</p>}
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
        <LockGate>
          <MyWallet onRemoved={() => setExists(false)} />
        </LockGate>
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

/**
 * Wallet protégé : la page demande le code (ou l'empreinte) avant d'afficher
 * le solde et l'adresse, puis se referme après le délai choisi.
 */
function LockGate({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [open, setOpen] = useState<boolean | null>(null);

  const ask = () => void unlockForPage().then(setOpen);
  useEffect(() => {
    // Déjà ouvert récemment (délai pas écoulé) : pas de nouvelle demande.
    if (!isProtected() || !isLocked()) return setOpen(true);
    setOpen(false);
    // Après le montage de la fenêtre de déverrouillage (WalletUnlock).
    const timer = setTimeout(ask, 0);
    return () => clearTimeout(timer);
  }, []);

  // « Déconnecter » (en-tête) : la page se referme aussi.
  useEffect(() => {
    if (!open) return;
    let wasConnected = getWalletState().isConnected;
    return subscribeWallet((s) => {
      if (wasConnected && !s.isConnected && isProtected()) setOpen(false);
      wasConnected = s.isConnected;
    });
  }, [open]);

  // Se referme au bout du délai choisi (5 min, 30 min…).
  useEffect(() => {
    if (!open || !isProtected()) return;
    const after = builtinProtection()?.lockAfterMs ?? 0;
    if (after <= 0) return;
    const timer = setTimeout(() => setOpen(false), after);
    return () => clearTimeout(timer);
  }, [open]);

  // « À chaque opération » : quitter l'écran (autre onglet, autre appli)
  // referme la page ; au retour, le code est redemandé.
  useEffect(() => {
    if (!open) return;
    const onHidden = () => {
      if (document.visibilityState !== "hidden") return;
      if (!isProtected() || builtinProtection()?.lockAfterMs !== 0) return;
      lockBuiltin();
      setOpen(false);
      const onBack = () => {
        if (document.visibilityState !== "visible") return;
        document.removeEventListener("visibilitychange", onBack);
        ask();
      };
      document.addEventListener("visibilitychange", onBack);
    };
    document.addEventListener("visibilitychange", onHidden);
    return () => document.removeEventListener("visibilitychange", onHidden);
  }, [open]);

  if (open === null) return null;
  if (open) return <>{children}</>;
  return (
    <div className="space-y-3 rounded-2xl border bg-card px-4 py-10 text-center">
      <Lock className="mx-auto size-7 text-primary" aria-hidden />
      <h2 className="text-lg font-semibold">{t("wallet.page.locked.title")}</h2>
      <p className="text-sm text-muted-foreground">{t("wallet.page.locked.text")}</p>
      <Button onClick={ask}>{t("wallet.page.locked.button")}</Button>
    </div>
  );
}

/** Une partie repliée de la page : titre (et état), contenu au clic. */
function Fold({
  icon,
  title,
  status,
  warn,
  children,
}: {
  icon: ReactNode;
  title: string;
  status?: string;
  /** État à surveiller (pas de protection) : en orange. */
  warn?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="group rounded-2xl border bg-card p-4 text-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-md font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="flex items-center gap-2">
          {icon}
          {title}
          {status ? (
            <span
              className={`font-normal ${warn ? "text-amber-700 dark:text-amber-400" : "text-primary"}`}
            >
              · {status}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none"
          aria-hidden
        />
      </summary>
      <div className="mt-3 space-y-3">{children}</div>
    </details>
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
function ProtectionSection({ onChange }: { onChange: () => void }) {
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
      onChange();
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
    <div className="space-y-3">
      <div className="flex items-baseline justify-end gap-2">
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
    </div>
  );
}

/** Le wallet : solde et boutons en haut ; protection, phrase et achat repliés. */
function MyWallet({ onRemoved }: { onRemoved: () => void }) {
  const { t } = useI18n();
  const address = builtinAddress(TESTNET ? "kaspatest" : "kaspa")!;
  const [balance, setBalance] = useState<bigint | null>(null);
  const [balanceError, setBalanceError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [receiving, setReceiving] = useState(false);
  const [shownPhrase, setShownPhrase] = useState<string | null>(null);
  const [inUse, setInUse] = useState(false);
  const [protection, setProtection] = useState<Protection | null>(null);

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
    setProtection(builtinProtection());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  const copy = () =>
    void navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });

  const protectionStatus = t(
    protection?.code && protection.bio
      ? "wallet.lock.short.both"
      : protection?.bio
        ? "wallet.lock.short.bio"
        : protection?.code
          ? "wallet.lock.short.code"
          : "wallet.lock.short.none",
  );

  return (
    <div className="space-y-3">
      <section className="space-y-3 rounded-2xl border bg-card p-4 text-sm">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-muted-foreground">{t("wallet.page.balance")}</h2>
          <button
            type="button"
            className="rounded-md p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={refresh}
            aria-label={t("wallet.page.refresh")}
            title={t("wallet.page.refresh")}
          >
            <RefreshCw className="size-4" aria-hidden />
          </button>
        </div>
        <p className="text-3xl font-semibold tracking-tight" aria-live="polite">
          {balanceError ? (
            <span className="text-sm font-normal text-destructive">{t("wallet.err.node")}</span>
          ) : balance === null ? (
            "…"
          ) : (
            `${kas(balance)} ${TESTNET ? "TKAS" : "KAS"}`
          )}
        </p>
        {inUse ? (
          <p className="flex items-center gap-1.5 text-xs text-primary">
            <CircleCheck className="size-4" aria-hidden />
            {t("wallet.page.inUse")}{" "}
            <Link to="/" className="underline">
              {t("wallet.page.seeHunts")}
            </Link>
          </p>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              connectBuiltin();
              setInUse(true);
            }}
          >
            {t("wallet.page.use")}
          </Button>
        )}
        <div className={`grid gap-2 ${TESTNET ? "grid-cols-2" : "grid-cols-1"}`}>
          {TESTNET && (
            <Button
              onClick={() => {
                copy();
                window.open(FAUCET, "_blank", "noopener");
              }}
            >
              {t("wallet.page.freeKas")}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setReceiving((r) => !r)}
            aria-expanded={receiving}
          >
            {t("wallet.page.receive")}
          </Button>
        </div>
        {TESTNET && <p className="text-xs text-muted-foreground">{t("wallet.page.faucetNote")}</p>}
        {receiving && (
          <div className="space-y-3 border-t pt-3">
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
            {TESTNET && <p className="text-xs text-muted-foreground">{t("wallet.page.testnet")}</p>}
          </div>
        )}
      </section>

      <Fold
        icon={<ShieldCheck className="size-4" aria-hidden />}
        title={t("wallet.lock.title")}
        status={protectionStatus}
        warn={!protection?.code && !protection?.bio}
      >
        <ProtectionSection onChange={() => setProtection(builtinProtection())} />
      </Fold>

      <Fold icon={<KeyRound className="size-4" aria-hidden />} title={t("wallet.page.phraseTitle")}>
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
      </Fold>

      <Fold
        icon={<ShoppingCart className="size-4" aria-hidden />}
        title={t("wallet.page.buyTitle")}
      >
        {TESTNET ? (
          <p className="text-xs text-muted-foreground">{t("wallet.page.buyLater")}</p>
        ) : (
          <>
            {ONRAMP ? (
              <Button
                className="w-full"
                onClick={() => {
                  copy();
                  window.open(ONRAMP, "_blank", "noopener");
                }}
              >
                {t("wallet.page.buy")}
              </Button>
            ) : null}
            {SHOPS.map((shop) => (
              <div key={shop.name} className="flex items-center gap-3">
                <span className="min-w-0 flex-1">
                  <span className="font-semibold">{shop.name}</span>{" "}
                  <span className="text-muted-foreground">· {t(shop.note)}</span>
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    copy();
                    window.open(shop.href, "_blank", "noopener");
                  }}
                >
                  {t("picker.get")}
                  <ExternalLink className="size-3.5" aria-hidden />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                copy();
                window.open(CHANGENOW, "_blank", "noopener");
              }}
            >
              {t("wallet.page.changenow")}
            </Button>
            <p className="text-xs text-muted-foreground">{t("wallet.page.changenowNote")}</p>
          </>
        )}
        <p className="text-xs text-muted-foreground">{t("wallet.page.buyNote")}</p>
      </Fold>

      <div className="pt-3 text-center">
        <button
          type="button"
          className="text-xs text-destructive underline"
          onClick={() => {
            if (!window.confirm(t("wallet.page.removeConfirm"))) return;
            // Wallet protégé : le code (ou l'empreinte) d'abord.
            const go = isProtected() ? unlockForPage() : Promise.resolve(true);
            void go.then((ok) => {
              if (!ok) return;
              if (getWalletState().kind === "builtin") disconnectWallet();
              removeBuiltinWallet();
              onRemoved();
            });
          }}
        >
          {t("wallet.page.remove")}
        </button>
      </div>
    </div>
  );
}
