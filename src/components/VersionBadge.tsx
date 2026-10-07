// Pied de page (version statique) : numéro de version et ancrage sur Kaspa.
import { Link } from "@tanstack/react-router";
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
  return (
    <p className="mt-1">
      {t("release.version", { version: info.version })}
      {status && (
        <>
          {" · "}
          <Link
            to="/publish"
            className={`underline-offset-2 hover:underline ${status === "mismatch" ? "text-destructive" : ""}`}
          >
            {t(TEXT[status])}
          </Link>
        </>
      )}
    </p>
  );
}
