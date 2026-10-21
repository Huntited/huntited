// Pied de page (version statique) : numéro de version et ancrage sur Kaspa.
import { Link } from "@tanstack/react-router";
import { Shield, ShieldAlert, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { useI18n, type MessageKey } from "@/lib/i18n";
import { checkRelease, loadReleaseInfo, type ReleaseInfo, type ReleaseStatus } from "@/lib/release";

const TEXT: Record<ReleaseStatus, MessageKey> = {
  verified: "release.verified",
  mismatch: "release.mismatch",
  unanchored: "release.unanchored",
};

export function VersionBadge() {
  const { t } = useI18n();
  const [info, setInfo] = useState<ReleaseInfo | null>(null);
  const [status, setStatus] = useState<ReleaseStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadReleaseInfo().then(async (i) => {
      if (cancelled || !i) return;
      setInfo(i);
      try {
        const s = await checkRelease(i);
        if (!cancelled) setStatus(s);
      } catch {
        /* blockchain injoignable : on n'affiche que la version */
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!info) return null;
  const short = info.version.split("+")[0];
  const Icon = status === "verified" ? ShieldCheck : status === "mismatch" ? ShieldAlert : Shield;
  return (
    <Link
      to="/publish"
      title={`${t("release.version", { version: info.version })}${status ? ` · ${t(TEXT[status])}` : ""}`}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 hover:text-foreground ${
        status === "mismatch" ? "border-destructive text-destructive" : ""
      }`}
    >
      <Icon
        aria-hidden
        className={`size-3.5 ${status === "verified" ? "text-green-600 dark:text-green-400" : ""}`}
      />
      v{short}
      {status && <span>· {t(TEXT[status])}</span>}
    </Link>
  );
}
