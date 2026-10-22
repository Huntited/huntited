// Modération (docs/moderation.md) : liste publique des chasses masquées, et,
// pour la clé de publication (huntited.kas) seulement, masquer ou réafficher
// une chasse. Chaque décision est une transaction publique sur la chaîne.
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { publish } from "@/lib/chain";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { getChainHidden } from "@/lib/onchain/browser-index";
import type { LedgerHidden } from "@/lib/onchain/ledger";
import { HIDE_REASONS, type HideReason } from "@/lib/onchain/protocol";
import { huntIdFrom } from "@/lib/moderation";
import { WalletError } from "@/lib/wallet";

export function ModerationPanel({ isPublisher }: { isPublisher: boolean }) {
  const { t, date } = useI18n();
  const [hidden, setHidden] = useState<LedgerHidden[] | null>(null);
  const [target, setTarget] = useState("");
  const [reason, setReason] = useState<HideReason>("illegal");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void getChainHidden()
      .then(setHidden)
      .catch(() => setHidden([]));
  }, []);

  async function send(
    m: { t: "hide"; hunt: string; reason: HideReason } | { t: "unhide"; hunt: string },
  ) {
    setBusy(true);
    setMessage(null);
    try {
      await publish(m);
      setMessage(t("moderation.sent"));
      setTarget("");
    } catch (e) {
      setMessage(e instanceof WalletError ? e.message : t("err.unavailable"));
    } finally {
      setBusy(false);
    }
  }

  const id = huntIdFrom(target);
  const reasonText = (r: string) => t(`hide.reason.${r}` as MessageKey);

  return (
    <section aria-labelledby="moderation-title" className="mt-10 space-y-3">
      <h2 id="moderation-title" className="font-semibold">
        {t("moderation.title")}
      </h2>
      <p className="text-sm text-muted-foreground">{t("moderation.lead")}</p>

      {hidden === null ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : hidden.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("moderation.none")}</p>
      ) : (
        <ul className="divide-y border-y text-sm">
          {hidden.map((h) => (
            <li key={h.hunt} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                <Link
                  to="/hunt/$id"
                  params={{ id: h.hunt }}
                  className="font-mono text-xs underline"
                >
                  {h.hunt}
                </Link>{" "}
                · {reasonText(h.reason)} ·{" "}
                {date(new Date(h.at).toISOString(), { dateStyle: "medium" })}
              </span>
              {isPublisher && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void send({ t: "unhide", hunt: h.hunt })}
                >
                  {t("moderation.unhide")}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {isPublisher && (
        <form
          className="space-y-3 rounded-lg border p-4"
          onSubmit={(ev) => {
            ev.preventDefault();
            if (id) void send({ t: "hide", hunt: id, reason });
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="hide-target">{t("moderation.target")}</Label>
            <Input
              id="hide-target"
              value={target}
              onChange={(ev) => setTarget(ev.target.value)}
              placeholder="https://huntited.com/#/hunt/…"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="hide-reason">{t("moderation.reason")}</Label>
            <select
              id="hide-reason"
              value={reason}
              onChange={(ev) => setReason(ev.target.value as HideReason)}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            >
              {HIDE_REASONS.map((r) => (
                <option key={r} value={r}>
                  {reasonText(r)}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={busy || !id}>
            {t("moderation.hide")}
          </Button>
          <p className="text-xs text-muted-foreground">{t("moderation.publicNote")}</p>
        </form>
      )}
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </section>
  );
}
