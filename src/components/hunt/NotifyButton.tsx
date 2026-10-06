// « Me prévenir » : notification du navigateur au déclenchement ou à l'échec
// d'une chasse, sans compte ni wallet. Masqué si indisponible (mode local,
// navigateur incompatible, serveur sans clés de notification).
import { useEffect, useState } from "react";

import { Bell, BellRing } from "lucide-react";

import { useI18n, type MessageKey } from "@/lib/i18n";
import { followHunt, getPushKey, isFollowing, unfollowHunt } from "@/lib/push";

export function NotifyButton({ huntId }: { huntId: string }) {
  const { t, locale } = useI18n();
  const [available, setAvailable] = useState(false);
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<MessageKey | null>(null);

  useEffect(() => {
    let cancelled = false;
    setFollowing(isFollowing(huntId));
    void getPushKey().then((key) => !cancelled && setAvailable(key !== null));
    return () => {
      cancelled = true;
    };
  }, [huntId]);

  if (!available) return null;

  async function toggle() {
    setBusy(true);
    setNote(null);
    if (following) {
      await unfollowHunt(huntId);
      setFollowing(false);
    } else {
      const r = await followHunt(huntId, locale);
      if (r === "ok") setFollowing(true);
      else setNote(r === "denied" ? "notify.denied" : "notify.unavailable");
    }
    setBusy(false);
  }

  return (
    <div className="mt-4 space-y-1 text-sm">
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={busy}
        aria-pressed={following}
        className="inline-flex items-center gap-1.5 font-medium underline-offset-2 hover:underline disabled:opacity-50"
      >
        {following ? (
          <BellRing className="size-4" aria-hidden="true" />
        ) : (
          <Bell className="size-4" aria-hidden="true" />
        )}
        {following ? t("notify.on") : t("notify.follow")}
      </button>
      {(note || !following) && (
        <p className="text-xs text-muted-foreground" role={note ? "alert" : undefined}>
          {note ? t(note) : t("notify.hint")}
        </p>
      )}
    </div>
  );
}
