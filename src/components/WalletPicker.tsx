// Fenêtre « Connecter un wallet » : à gauche les wallets (ceux de cet appareil,
// puis les extensions à installer), à droite ce qu'est un wallet, la création
// du wallet Huntited et, sur le vrai réseau, l'achat de KAS.
import { useNavigate } from "@tanstack/react-router";
import { Castle, ExternalLink, Fish, KeyRound, UserRoundCheck } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { LogoMark } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { REGISTRY_ADDRESS } from "@/lib/chain";
import { useI18n } from "@/lib/i18n";
import { detectWallets, type WalletChoice } from "@/lib/wallet";
import { closePicker, subscribePicker } from "@/lib/wallet-picker";

const TESTNET = REGISTRY_ADDRESS.startsWith("kaspatest:");
const FAUCET = "https://faucet-tn10.kaspanet.io/";

const EXTENSIONS: { id: "kastle" | "kasperia"; name: string; icon: ReactNode; install: string }[] =
  [
    {
      id: "kastle",
      name: "Kastle",
      icon: <Castle className="h-5 w-5" aria-hidden="true" />,
      install: "https://kastle.cc/",
    },
    {
      id: "kasperia",
      name: "Kasperia",
      icon: <Fish className="h-5 w-5" aria-hidden="true" />,
      install: "https://chromewebstore.google.com/detail/kasperia/ffalcabgggegkejjlknofllbaledgcob",
    },
  ];

/** Achat de KAS en euros (vrai réseau seulement). */
const SHOPS = [
  { name: "Deskoin", note: "picker.deskoin", href: "https://deskoin.com/en/acheter/kaspa" },
  { name: "Kraken", note: "picker.kraken", href: "https://www.kraken.com/buy/kas" },
] as const;

function WalletRow({
  icon,
  name,
  note,
  onClick,
}: {
  icon: ReactNode;
  name: string;
  note?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{name}</span>
        {note ? <span className="block text-xs text-primary">{note}</span> : null}
      </span>
    </button>
  );
}

export function WalletPicker() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [found, setFound] = useState<Record<WalletChoice, boolean>>({
    builtin: false,
    kastle: false,
    kasperia: false,
  });
  useEffect(() => subscribePicker(setOpen), []);
  // Les extensions s'annoncent au chargement : on regarde à chaque ouverture.
  useEffect(() => {
    if (open) setFound(detectWallets());
  }, [open]);

  const here = EXTENSIONS.filter((w) => found[w.id]);
  const others = EXTENSIONS.filter((w) => !found[w.id]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && closePicker(null)}>
      <DialogContent className="max-h-[90dvh] gap-0 overflow-y-auto p-0 sm:max-w-2xl">
        <div className="grid md:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)]">
          <div className="space-y-4 border-b p-5 md:border-b-0 md:border-r">
            <DialogTitle className="text-lg">{t("picker.title")}</DialogTitle>
            {found.builtin || here.length > 0 ? (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-primary">{t("picker.here")}</p>
                {found.builtin ? (
                  <WalletRow
                    icon={<LogoMark className="h-6 w-6" />}
                    name={t("picker.builtin")}
                    note={t("picker.builtinNote")}
                    onClick={() => closePicker("builtin")}
                  />
                ) : null}
                {here.map((w) => (
                  <WalletRow
                    key={w.id}
                    icon={w.icon}
                    name={w.name}
                    note={t("picker.installed")}
                    onClick={() => closePicker(w.id)}
                  />
                ))}
              </div>
            ) : null}
            {others.length > 0 ? (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground">{t("picker.others")}</p>
                {others.map((w) => (
                  <div key={w.id} className="flex items-center gap-3 px-2 py-2">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      {w.icon}
                    </span>
                    <span className="min-w-0 flex-1 text-sm font-semibold">{w.name}</span>
                    <Button asChild variant="secondary" size="sm">
                      <a href={w.install} target="_blank" rel="noopener noreferrer">
                        {t("picker.install")}
                      </a>
                    </Button>
                  </div>
                ))}
                <p className="px-2 text-xs text-muted-foreground">{t("picker.installNote")}</p>
              </div>
            ) : null}
          </div>

          <div className="space-y-5 p-5">
            <p className="text-base font-semibold md:pr-6">{t("picker.what")}</p>
            <DialogDescription asChild>
              <ul className="space-y-3">
                <li className="flex gap-3">
                  <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                  <span>
                    <span className="block text-sm font-semibold text-foreground">
                      {t("picker.what1.title")}
                    </span>
                    <span className="block text-sm text-muted-foreground">{t("picker.what1")}</span>
                  </span>
                </li>
                <li className="flex gap-3">
                  <UserRoundCheck
                    className="mt-0.5 h-5 w-5 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-foreground">
                      {t("picker.what2.title")}
                    </span>
                    <span className="block text-sm text-muted-foreground">{t("picker.what2")}</span>
                  </span>
                </li>
              </ul>
            </DialogDescription>

            {!found.builtin ? (
              <div className="space-y-2 border-t pt-4">
                <p className="text-sm font-semibold">{t("picker.none")}</p>
                <Button
                  className="w-full"
                  onClick={() => {
                    closePicker(null);
                    void navigate({ to: "/wallet" });
                  }}
                >
                  {t("picker.create")}
                </Button>
                <p className="text-xs text-muted-foreground">{t("picker.createNote")}</p>
              </div>
            ) : null}

            <div className="space-y-2 border-t pt-4">
              <p className="text-sm font-semibold">{t("picker.buy")}</p>
              {TESTNET ? (
                <p className="text-xs text-muted-foreground">
                  {t("picker.testnet")}{" "}
                  <a
                    href={FAUCET}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary underline underline-offset-2"
                  >
                    {t("picker.faucet")}
                  </a>
                </p>
              ) : (
                SHOPS.map((shop) => (
                  <div key={shop.name} className="flex items-center gap-3">
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="font-semibold">{shop.name}</span>{" "}
                      <span className="text-muted-foreground">· {t(shop.note)}</span>
                    </span>
                    <Button asChild variant="secondary" size="sm">
                      <a href={shop.href} target="_blank" rel="noopener noreferrer">
                        {t("picker.get")}
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      </a>
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
