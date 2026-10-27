import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { COMMIT_DEPOSIT_KAS } from "@/lib/covenants";
import { clearCreateHuntDraft, getCreateHuntDraft } from "@/lib/create-hunt-store";
import { createHunt, getDataMode, HuntActionError } from "@/lib/hunt-repository";
import { countryName } from "@/lib/countries";
import { isOnlineHunt, placeLabel } from "@/lib/online";
import { useI18n } from "@/lib/i18n";
import { addUserHunt } from "@/lib/user-hunts";
import { useWallet } from "@/lib/useWallet";
import type { HuntFormData } from "@/lib/types";

export const Route = createFileRoute("/create-review")({
  head: () => ({
    meta: [
      { title: "Vérifier mon action — Huntited" },
      {
        name: "description",
        content: "Relis ton action avant de la créer et de verrouiller le dépôt.",
      },
      { property: "og:title", content: "Vérifier mon action — Huntited" },
      {
        property: "og:description",
        content: "Relis ton action avant de la créer et de verrouiller le dépôt.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CreateReviewPage,
});

/**
 * Récapitulatif avant création : le brouillon est lu depuis l'appareil.
 * Sans brouillon, on renvoie vers le formulaire.
 */
function CreateReviewPage() {
  const navigate = useNavigate();
  const { t, date, locale } = useI18n();
  const wallet = useWallet();
  const { address } = wallet;
  const [draft, setDraft] = useState<HuntFormData | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lecture après montage (localStorage indisponible côté serveur)
  useEffect(() => {
    const data = getCreateHuntDraft();
    if (!data) {
      navigate({ to: "/create", replace: true });
      return;
    }
    setDraft(data);
  }, [navigate]);

  if (!draft) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10 text-sm text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  const handleConfirm = async () => {
    // Le wallet créateur est obligatoire : sans lui, personne ne pourrait
    // ouvrir le chat de la chasse une fois le seuil atteint.
    if (!address) return;
    setIsCreating(true);
    setError(null);
    try {
      // Création via hunt-repository (mock local ou registre partagé, qui
      // demande alors une signature du wallet). Aucun log du contenu.
      const huntId = await createHunt(draft, address);

      // Mémorise la chasse dans l'historique local du créateur
      // (références uniquement, stockées sur l'appareil).
      addUserHunt(address, {
        huntId,
        title: draft.title,
        location: draft.location,
        deadline: new Date(draft.deadline).toISOString(),
        threshold: draft.threshold,
      });

      clearCreateHuntDraft();
      navigate({ to: "/hunt/$id", params: { id: huntId } });
    } catch (e) {
      setError(e instanceof HuntActionError ? e.message : t("review.createError"));
      setIsCreating(false);
    }
  };

  const rows: Array<[string, string]> = [
    [t("hunt.location"), placeLabel(draft, t)],
    ...(isOnlineHunt(draft)
      ? []
      : ([[t("hunt.country"), draft.country ? countryName(draft.country, locale) : "—"]] as Array<
          [string, string]
        >)),
    [t("hunt.deadline"), date(draft.deadline, { dateStyle: "long", timeStyle: "short" })],
    [t("hunt.threshold"), t("hunt.thresholdValue", { count: draft.threshold })],
    [
      t("review.progress"),
      draft.progressVisibility === "hidden" ? t("review.hidden") : t("review.visible"),
    ],
    [t("form.caution"), `${draft.deposit} KAS`],
    [t("hunt.commitDeposit"), `${COMMIT_DEPOSIT_KAS} KAS`],
  ];

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{t("review.title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("review.lead")}</p>

      <div className="mt-6 space-y-4 rounded-lg border p-5 text-sm">
        <div>
          <div className="text-muted-foreground">{t("form.title")}</div>
          <div className="font-medium">{draft.title}</div>
        </div>
        <div>
          <div className="text-muted-foreground">{t("form.description")}</div>
          <p className="whitespace-pre-line">{draft.description}</p>
        </div>
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4">
            <span className="text-muted-foreground">{label}</span>
            <span className="text-right font-medium">{value}</span>
          </div>
        ))}
      </div>

      {error && (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {!address && (
        <p className="mt-4 text-sm text-muted-foreground" role="status">
          {t("review.needWallet")}
        </p>
      )}

      {getDataMode() === "chain" && (
        <p className="mt-4 text-xs text-muted-foreground">{t("chain.createNote")}</p>
      )}

      <div className="mt-6 flex justify-end gap-3">
        <Button variant="outline" disabled={isCreating} onClick={() => navigate({ to: "/create" })}>
          {t("review.back")}
        </Button>
        {address ? (
          <Button disabled={isCreating} onClick={handleConfirm}>
            {isCreating ? t("review.creating") : t("review.confirm")}
          </Button>
        ) : (
          <Button disabled={wallet.isLoading} onClick={() => void wallet.connectWallet()}>
            {wallet.isLoading ? t("wallet.connecting") : t("wallet.connect")}
          </Button>
        )}
      </div>
    </div>
  );
}
