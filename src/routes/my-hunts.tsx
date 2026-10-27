import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { EmptyState } from "@/components/EmptyState";
import { LogoMark } from "@/components/Logo";
import { BadgesPanel } from "@/components/hunt/BadgesPanel";
import { HuntCard } from "@/components/hunt/HuntCard";
import { Button } from "@/components/ui/button";
import {
  getDataMode,
  listHuntViews,
  onHuntsChange,
  isCommitted,
  type HuntView,
} from "@/lib/hunt-repository";
import { useI18n } from "@/lib/i18n";
import { useWallet } from "@/lib/useWallet";
import { getUserHunts } from "@/lib/user-hunts";

export const Route = createFileRoute("/my-hunts")({
  head: () => ({
    meta: [
      { title: "Mes chasses — Huntited" },
      {
        name: "description",
        content: "Retrouve les chasses que tu as créées et celles où tu t'es engagé·e.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MyHuntsPage,
});

/**
 * Chasses créées et engagements du wallet connecté, puis ses badges.
 * Mémorisés sur l'appareil ; en mode registre partagé, « Synchroniser »
 * récupère l'activité faite sur d'autres appareils (une signature).
 */
function MyHuntsPage() {
  const { address, isConnected, isLoading, connectWallet } = useWallet();
  const { t } = useI18n();
  const [version, setVersion] = useState(0);
  const [views, setViews] = useState<HuntView[] | null>(null);
  const [sync, setSync] = useState<{ busy: boolean; message: string | null }>({
    busy: false,
    message: null,
  });

  useEffect(() => onHuntsChange(() => setVersion((v) => v + 1)), []);
  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    listHuntViews()
      .then((v) => !cancelled && setViews(v))
      .catch(() => !cancelled && setViews([]));
    return () => {
      cancelled = true;
    };
  }, [address, version]);

  if (!isConnected || !address) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
        <LogoMark className="h-12 w-12" />
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">{t("nav.myHunts")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("my.connect")}</p>
        <Button className="mt-5" onClick={() => connectWallet()} disabled={isLoading}>
          {isLoading ? t("wallet.connecting") : t("wallet.connect")}
        </Button>
      </div>
    );
  }

  // Chasses créées : vues du registre quand elles y sont, sinon la mémoire locale.
  const createdIds = getUserHunts(address).map((h) => h.huntId);
  const created = createdIds
    .map((id) => views?.find((v) => v.hunt.id === id))
    .filter((v): v is HuntView => v !== undefined);
  const engaged = (views ?? []).filter((v) => isCommitted(v.hunt.id, address));

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{t("nav.myHunts")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("my.leadLocal")}</p>

      <Section title={t("my.created")} count={created.length}>
        {views === null ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : created.length === 0 ? (
          <EmptyState title={t("my.noHunts")} action={t("home.create")} />
        ) : (
          <CardList items={created} />
        )}
      </Section>

      <Section title={t("my.commitments")} count={engaged.length}>
        {views === null ? null : engaged.length === 0 ? (
          <EmptyState title={t("my.noCommitments")} action={t("my.browse")} to="/" />
        ) : (
          <CardList items={engaged} />
        )}
      </Section>

      <BadgesPanel address={address} />
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        {title}
        {count > 0 && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {count}
          </span>
        )}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function CardList({ items }: { items: HuntView[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map(({ hunt, status, commitCount }) => (
        <li key={hunt.id}>
          <HuntCard hunt={hunt} status={status} commitCount={commitCount} />
        </li>
      ))}
    </ul>
  );
}
