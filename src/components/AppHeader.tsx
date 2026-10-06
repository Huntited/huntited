import { Link } from "@tanstack/react-router";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { useI18n, type Locale, type MessageKey } from "@/lib/i18n";
import { useWallet } from "@/lib/useWallet";

const NAV: { to: "/" | "/create" | "/my-hunts" | "/pass"; label: MessageKey }[] = [
  { to: "/", label: "nav.hunts" },
  { to: "/create", label: "nav.create" },
  { to: "/my-hunts", label: "nav.myHunts" },
  { to: "/pass", label: "nav.pass" },
];

/** Forme courte d'une adresse (jamais l'adresse complète à l'écran). */
const shortAddress = (a: string) => `${a.slice(0, 10)}…${a.slice(-4)}`;

/** En-tête commun : logo, navigation, wallet et langue. */
export function AppHeader() {
  const { t, locale, setLocale } = useI18n();
  const { isConnected, address, isLoading, connectWallet, disconnectWallet } = useWallet();

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <Link to="/" aria-label={t("nav.home")} className="shrink-0">
          <Logo />
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSwitch locale={locale} onChange={setLocale} label={t("lang.switch")} />
          {isConnected && address ? (
            <>
              <code className="hidden text-xs text-muted-foreground sm:inline">
                {shortAddress(address)}
              </code>
              <Button variant="outline" size="sm" onClick={disconnectWallet}>
                {t("wallet.disconnect")}
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => connectWallet()} disabled={isLoading}>
              {isLoading ? t("wallet.connecting") : t("wallet.connect")}
            </Button>
          )}
        </div>
      </div>
      <nav aria-label={t("nav.menu")} className="mx-auto max-w-3xl overflow-x-auto px-4">
        <ul className="flex gap-1 pb-2 text-sm">
          {NAV.map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                activeOptions={{ exact: item.to === "/" }}
                className="block whitespace-nowrap rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                activeProps={{ className: "bg-accent font-medium !text-foreground" }}
              >
                {t(item.label)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}

function LanguageSwitch({
  locale,
  onChange,
  label,
}: {
  locale: Locale;
  onChange: (l: Locale) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex rounded-md border p-0.5 text-xs">
      {(["fr", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => onChange(l)}
          aria-pressed={locale === l}
          aria-label={l === "fr" ? "Français" : "English"}
          title={l === "fr" ? "Français" : "English"}
          lang={l}
          className={`rounded px-2 py-1 font-medium uppercase transition-colors ${
            locale === l
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

/** Pied de page : promesse, rappel « version de test ». */
export function AppFooter() {
  const { t } = useI18n();
  return (
    <footer className="mx-auto mt-16 max-w-3xl border-t px-4 py-6 text-xs text-muted-foreground">
      <p>{t("footer.tagline")}</p>
      <p className="mt-1">{t("footer.testnet")}</p>
    </footer>
  );
}
