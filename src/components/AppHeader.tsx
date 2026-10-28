import { Link, useRouterState } from "@tanstack/react-router";
import { Check, Menu, Moon, Palette as PaletteIcon, Sun, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Logo } from "@/components/Logo";
import { VersionBadge } from "@/components/VersionBadge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n, type Locale, type MessageKey } from "@/lib/i18n";
import { PALETTES, useTheme, type Palette } from "@/lib/theme";
import { useWallet } from "@/lib/useWallet";
import { NotificationBell } from "@/components/NotificationBell";
import { getDataMode } from "@/lib/hunt-repository";

const NAV: {
  to: "/" | "/create" | "/my-hunts" | "/wallet" | "/profile";
  label: MessageKey;
}[] = [
  { to: "/", label: "nav.hunts" },
  { to: "/create", label: "nav.create" },
  { to: "/my-hunts", label: "nav.myHunts" },
  { to: "/profile", label: "nav.progress" },
  { to: "/wallet", label: "nav.wallet" },
];

/** Forme courte d'une adresse (jamais l'adresse complète à l'écran). */
const shortAddress = (a: string) => `${a.slice(0, 10)}…${a.slice(-4)}`;

const linkClass =
  "block whitespace-nowrap rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const activeLink = {
  className: "bg-accent font-medium !text-foreground",
  "aria-current": "page" as const,
};

/**
 * En-tête commun : logo, navigation, wallet, langue et thème.
 * Sur mobile, la navigation (et la langue) passent dans un menu repliable.
 */
export function AppHeader() {
  const { t, locale, setLocale } = useI18n();
  const { isConnected, address, isLoading, connectWallet, disconnectWallet } = useWallet();
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Le menu se referme à chaque changement de page, et avec Échap.
  useEffect(() => setMenuOpen(false), [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-3">
        <Link to="/" aria-label={t("nav.home")} className="shrink-0 rounded-md">
          <Logo />
        </Link>
        <div className="flex items-center gap-2">
          <div className="hidden sm:block">
            <LanguageSwitch locale={locale} onChange={setLocale} label={t("lang.switch")} />
          </div>
          {/* Activité de tes chasses (sur la chaîne) : messages, résultats. */}
          {getDataMode() === "chain" && <NotificationBell />}
          <ThemeMenu />
          {isConnected && address ? (
            <>
              <Link
                to="/wallet"
                className="hidden text-xs text-muted-foreground underline-offset-2 hover:underline md:inline"
                title={t("wallet.page.title")}
              >
                <code>{shortAddress(address)}</code>
              </Link>
              <Button variant="outline" size="sm" onClick={disconnectWallet}>
                {t("wallet.disconnect")}
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => connectWallet()} disabled={isLoading}>
              {isLoading ? t("wallet.connecting") : t("wallet.connect")}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="sm:hidden"
            aria-label={t(menuOpen ? "nav.close" : "nav.open")}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </Button>
        </div>
      </div>

      {/* Navigation : onglets sur grand écran… */}
      <nav aria-label={t("nav.menu")} className="mx-auto hidden max-w-3xl px-4 sm:block">
        <ul className="flex gap-1 pb-2 text-sm">
          {NAV.map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                activeOptions={{ exact: item.to === "/" }}
                className={linkClass}
                activeProps={activeLink}
              >
                {t(item.label)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* …menu repliable sur mobile. */}
      {menuOpen && (
        <nav
          id="mobile-menu"
          aria-label={t("nav.menu")}
          className="border-t px-4 pb-4 pt-2 sm:hidden"
        >
          <ul className="space-y-1 text-base">
            {NAV.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  activeOptions={{ exact: item.to === "/" }}
                  className={`${linkClass} py-2`}
                  activeProps={activeLink}
                >
                  {t(item.label)}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between border-t pt-3 text-sm">
            <span className="text-muted-foreground">{t("lang.switch")}</span>
            <LanguageSwitch locale={locale} onChange={setLocale} label={t("lang.switch")} />
          </div>
        </nav>
      )}
    </header>
  );
}

/** Aperçu de chaque palette dans le menu : couleur principale, chiffres. */
const SWATCH: Record<Palette, [string, string]> = {
  green: ["#1f7a4d", "#3ddc84"],
  ocean: ["#0e6f8a", "#4cc9e6"],
  coral: ["#c8432a", "#ff7a50"],
  paper: ["#1a1a1a", "#c8231b"],
  violet: ["#5b4bd6", "#a594ff"],
};

/** Menu « Thème » : la palette, puis clair ou sombre. */
function ThemeMenu() {
  const { t } = useI18n();
  const { theme, palette, setTheme, setPalette } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("theme.menu")} title={t("theme.menu")}>
          <PaletteIcon aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>{t("theme.menu")}</DropdownMenuLabel>
        {PALETTES.map((p) => (
          <DropdownMenuItem
            key={p}
            onSelect={(e) => {
              e.preventDefault();
              setPalette(p);
            }}
            aria-checked={palette === p}
            role="menuitemradio"
          >
            <span
              aria-hidden="true"
              className="h-4 w-4 shrink-0 rounded-full border"
              style={{
                background: `linear-gradient(135deg, ${SWATCH[p][0]} 50%, ${SWATCH[p][1]} 50%)`,
              }}
            />
            <span className="flex-1">{t(`theme.palette.${p}`)}</span>
            {palette === p ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <div role="group" aria-label={t("theme.mode")} className="grid grid-cols-2 gap-1 p-1">
          {(["light", "dark"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setTheme(mode)}
              aria-pressed={theme === mode}
              className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                theme === mode
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {mode === "light" ? (
                <Sun className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Moon className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {t(mode === "light" ? "theme.mode.light" : "theme.mode.dark")}
            </button>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
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
          className={`rounded px-2 py-1 font-medium uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
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
  const link = "underline-offset-2 hover:text-foreground hover:underline";
  return (
    <footer className="mx-auto mt-16 w-full max-w-3xl border-t px-4 py-6 text-xs text-muted-foreground">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <p>
          <span className="font-semibold text-foreground">Huntited</span> · {t("footer.tagline")}
        </p>
        <nav aria-label={t("footer.nav")} className="flex flex-wrap gap-x-4 gap-y-1">
          <Link to="/legal" className={link}>
            {t("footer.legalShort")}
          </Link>
          <Link to="/kaspa" className={link}>
            {t("footer.kaspa")}
          </Link>
          <Link to="/my-data" className={link}>
            {t("footer.data")}
          </Link>
          <Link to="/publish" className={link}>
            {t("footer.versions")}
          </Link>
          {/* Code public (AGPL-3.0) : chacun peut vérifier ce que fait le site. */}
          <a
            href="https://github.com/Huntited/huntited"
            target="_blank"
            rel="noopener noreferrer"
            className={link}
          >
            {t("footer.source")}
          </a>
        </nav>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5">
          <span aria-hidden className="size-1.5 rounded-full bg-amber-500" />
          {t("footer.testnet")}
        </span>
        <VersionBadge />
        <a
          href="https://www.geonames.org/"
          target="_blank"
          rel="noopener noreferrer"
          className={`ml-auto ${link}`}
        >
          {t("footer.geonames")}
        </a>
      </div>
    </footer>
  );
}
