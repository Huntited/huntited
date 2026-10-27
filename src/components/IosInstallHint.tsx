// iPhone et iPad (docs/iphone.md) : pas d'app sur l'App Store, mais le site
// s'installe comme une app depuis Safari. Bandeau discret, une fois, refermable.
import { Share, X } from "lucide-react";
import { useEffect, useState } from "react";

import { useI18n } from "@/lib/i18n";

const STORAGE = "huntited:ios-hint";

function shouldShow(): boolean {
  if (typeof window === "undefined") return false;
  const ios =
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  try {
    return ios && !standalone && localStorage.getItem(STORAGE) === null;
  } catch {
    return false;
  }
}

export function IosInstallHint() {
  const { t } = useI18n();
  const [show, setShow] = useState(false);
  useEffect(() => setShow(shouldShow()), []);
  if (!show) return null;

  const close = () => {
    setShow(false);
    try {
      localStorage.setItem(STORAGE, "seen");
    } catch {
      /* se réaffichera, sans gravité */
    }
  };

  return (
    <aside
      aria-label={t("ios.title")}
      className="fixed inset-x-3 bottom-3 z-50 rounded-lg border bg-card p-3 text-sm shadow-lg"
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 space-y-1">
          <p className="font-medium">{t("ios.title")}</p>
          <p className="text-muted-foreground">
            {t("ios.step1")} <Share className="inline size-4 align-text-bottom" aria-hidden />{" "}
            {t("ios.step2")}
          </p>
          <p className="text-xs text-muted-foreground">{t("ios.note")}</p>
        </div>
        <button type="button" onClick={close} aria-label={t("common.close")} className="p-1">
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </aside>
  );
}
