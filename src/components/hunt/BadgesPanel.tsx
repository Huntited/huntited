import { useEffect, useState } from "react";

import { Switch } from "@/components/ui/switch";
import { getWalletBadges } from "@/lib/badge-activity";
import { getBadgeVisibility, setBadgeVisibility, subscribeBadges } from "@/lib/badge-store";
import { BADGES, type BadgeTier, type EarnedBadge } from "@/lib/badges";
import { onCommitmentsChange } from "@/lib/covenants";
import { subscribeHuntState } from "@/lib/hunt-state-store";

const TIER_LABEL: Record<BadgeTier, string> = { bronze: "bronze", argent: "argent", or: "or" };

/**
 * Badges du wallet connecté (non financiers) et choix de leur visibilité.
 * Calculés sur cet appareil ; privés par défaut.
 */
export function BadgesPanel({ address }: { address: string }) {
  const [version, setVersion] = useState(0);
  const [earned, setEarned] = useState<EarnedBadge[]>([]);
  const [isPublic, setIsPublic] = useState(false);

  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    const unsubs = [subscribeBadges(bump), onCommitmentsChange(bump), subscribeHuntState(bump)];
    return () => unsubs.forEach((u) => u());
  }, []);

  useEffect(() => {
    setEarned(getWalletBadges(address));
    setIsPublic(getBadgeVisibility(address) === "public");
  }, [address, version]);

  const earnedById = new Map(earned.map((b) => [b.id, b]));
  const locked = BADGES.filter((b) => !earnedById.has(b.id));

  return (
    <section className="mt-10 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Mes badges</h2>
        <p className="text-sm text-muted-foreground">
          Des récompenses symboliques : elles ne changent jamais les montants en KAS.
        </p>
      </div>

      {earned.length === 0 ? (
        <p className="text-sm text-muted-foreground">Pas encore de badge.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {BADGES.filter((b) => earnedById.has(b.id)).map((b) => {
            const e = earnedById.get(b.id)!;
            return (
              <li key={b.id} className="rounded-lg border p-3">
                <div className="font-medium">
                  {b.name}
                  {e.tier && (
                    <span className="ml-2 text-xs text-muted-foreground">{TIER_LABEL[e.tier]}</span>
                  )}
                  {e.count > 1 && !e.tier && (
                    <span className="ml-2 text-xs text-muted-foreground">×{e.count}</span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{b.description}</p>
              </li>
            );
          })}
        </ul>
      )}

      {locked.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">
            À débloquer ({locked.length})
          </summary>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            {locked.map((b) => (
              <li key={b.id}>
                <span className="font-medium">{b.name}</span> — {b.description}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="rounded-lg border p-3">
        <label className="flex cursor-pointer items-center justify-between gap-4 text-sm">
          <span className="font-medium">Badges visibles publiquement</span>
          <Switch
            checked={isPublic}
            onCheckedChange={(checked) => {
              setBadgeVisibility(address, checked ? "public" : "private");
            }}
            aria-label="Badges visibles publiquement"
          />
        </label>
        <p className="mt-2 text-xs text-muted-foreground">
          Réglage propre à ce wallet. Désactivé, tes badges ne sont visibles que par toi : ils
          pourraient sinon révéler les chasses auxquelles tu as participé. Aucun profil public
          n'existe encore dans ce prototype ; ce choix sera appliqué dès qu'il y en aura un.
        </p>
      </div>
    </section>
  );
}
