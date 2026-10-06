import { useEffect, useState } from "react";

import { Switch } from "@/components/ui/switch";
import { loadWalletBadges } from "@/lib/badge-activity";
import { getBadgeVisibility, setBadgeVisibility, subscribeBadges } from "@/lib/badge-store";
import { BADGES, type BadgeTier, type EarnedBadge } from "@/lib/badges";
import { onHuntsChange } from "@/lib/hunt-repository";
import { useI18n, type MessageKey } from "@/lib/i18n";

const TIER_LABEL: Record<BadgeTier, MessageKey> = {
  bronze: "badge.tier.bronze",
  argent: "badge.tier.argent",
  or: "badge.tier.or",
};
const badgeName = (id: string) => `badge.${id}.name` as MessageKey;
const badgeText = (id: string) => `badge.${id}.text` as MessageKey;

/**
 * Badges du wallet connecté (non financiers) et choix de leur visibilité.
 * Calculés sur cet appareil ; privés par défaut.
 */
export function BadgesPanel({ address }: { address: string }) {
  const { t } = useI18n();
  const [version, setVersion] = useState(0);
  const [earned, setEarned] = useState<EarnedBadge[]>([]);
  const [isPublic, setIsPublic] = useState(false);

  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    const unsubs = [subscribeBadges(bump), onHuntsChange(bump)];
    return () => unsubs.forEach((u) => u());
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsPublic(getBadgeVisibility(address) === "public");
    loadWalletBadges(address)
      .then((b) => !cancelled && setEarned(b))
      .catch(() => !cancelled && setEarned([]));
    return () => {
      cancelled = true;
    };
  }, [address, version]);

  const earnedById = new Map(earned.map((b) => [b.id, b]));
  const locked = BADGES.filter((b) => !earnedById.has(b.id));

  return (
    <section className="mt-10 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{t("badges.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("badges.lead")}</p>
      </div>

      {earned.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("badges.none")}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {BADGES.filter((b) => earnedById.has(b.id)).map((b) => {
            const e = earnedById.get(b.id)!;
            return (
              <li key={b.id} className="rounded-lg border p-3">
                <div className="font-medium">
                  {t(badgeName(b.id))}
                  {e.tier && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {t(TIER_LABEL[e.tier])}
                    </span>
                  )}
                  {e.count > 1 && !e.tier && (
                    <span className="ml-2 text-xs text-muted-foreground">×{e.count}</span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{t(badgeText(b.id))}</p>
              </li>
            );
          })}
        </ul>
      )}

      {locked.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">
            {t("badges.locked", { count: locked.length })}
          </summary>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            {locked.map((b) => (
              <li key={b.id}>
                <span className="font-medium">{t(badgeName(b.id))}</span> — {t(badgeText(b.id))}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="rounded-lg border p-3">
        <label className="flex cursor-pointer items-center justify-between gap-4 text-sm">
          <span className="font-medium">{t("badges.public")}</span>
          <Switch
            checked={isPublic}
            onCheckedChange={(checked) => {
              setBadgeVisibility(address, checked ? "public" : "private");
            }}
            aria-label={t("badges.public")}
          />
        </label>
        <p className="mt-2 text-xs text-muted-foreground">{t("badges.publicHelp")}</p>
      </div>
    </section>
  );
}
