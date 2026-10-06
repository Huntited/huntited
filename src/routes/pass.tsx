import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createInvitation,
  exportPass,
  forgetPass,
  getPassConfig,
  hasPass,
  importPass,
  joinWithInvitation,
  onPassChange,
  remainingInvites,
  PassError,
  type PassConfig,
} from "@/lib/pass";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/pass")({
  head: () => ({
    meta: [
      { title: "Mon pass — Huntited" },
      {
        name: "description",
        content: "Ton pass Huntited : une personne, un engagement, sans donnée personnelle.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PassPage,
});

/** Accepte un code seul ou un lien d'invitation complet (…/pass#code). */
const invitationFrom = (text: string) => text.trim().split("#").pop() ?? "";

function PassPage() {
  const { t } = useI18n();
  const [config, setConfig] = useState<PassConfig | null>(null);
  const [mine, setMine] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getPassConfig().then(setConfig);
    setMine(hasPass());
    // Invitation reçue par lien : le code est après « # » (jamais envoyé au
    // serveur de la page). On l'efface de la barre d'adresse et de l'historique.
    const fromLink = window.location.hash.slice(1);
    if (fromLink) {
      setCode(fromLink);
      window.history.replaceState(null, "", window.location.pathname);
    }
    return onPassChange(() => setMine(hasPass()));
  }, []);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof PassError ? t(e.key) : t("pass.err.generic"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <Link to="/" className="text-sm text-muted-foreground hover:underline">
        {t("common.back")}
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">{t("nav.pass")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("pass.lead")}</p>

      {config === null ? (
        <p className="mt-6 text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : !config.available ? (
        <p className="mt-6 rounded-lg border p-4 text-sm text-muted-foreground">
          {t("pass.unavailable")}
        </p>
      ) : mine ? (
        <ActivePass config={config} busy={busy} run={run} />
      ) : (
        <section className="mt-6 space-y-3 rounded-lg border p-4">
          <h2 className="font-semibold">{t("pass.join.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("pass.join.text")}</p>
          <label htmlFor="invitation" className="text-sm font-medium">
            {t("pass.join.label")}
          </label>
          <Input
            id="invitation"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="off"
          />
          <Button
            className="w-full"
            disabled={busy || !invitationFrom(code)}
            onClick={() =>
              void run(async () => {
                await joinWithInvitation(invitationFrom(code));
                setCode("");
                toast.success(t("pass.created"));
              })
            }
          >
            {busy ? t("pass.creating") : t("pass.create")}
          </Button>
          <RestorePass busy={busy} run={run} />
        </section>
      )}

      {error && (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function ActivePass({
  config,
  busy,
  run,
}: {
  config: PassConfig;
  busy: boolean;
  run: (action: () => Promise<void>) => Promise<void>;
}) {
  const { t } = useI18n();
  const [link, setLink] = useState<string | null>(null);
  const [left, setLeft] = useState(() => remainingInvites(config.invitesPerMonth));

  return (
    <div className="mt-6 space-y-4">
      <p className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-700">
        {t("pass.active")}
      </p>

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-semibold">{t("pass.invite.title")}</h2>
        <p className="text-sm text-muted-foreground">
          {t(left > 1 ? "pass.invite.textMany" : "pass.invite.textOne", { count: left })}
        </p>
        {link ? (
          <div className="space-y-2">
            <Input readOnly value={link} aria-label={t("pass.invite.link")} />
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                void navigator.clipboard
                  .writeText(link)
                  .then(() => toast.success(t("share.copied")))
                  .catch(() => toast.error(t("pass.invite.copyFailed")))
              }
            >
              {t("pass.invite.copy")}
            </Button>
            <p className="text-xs text-muted-foreground">{t("pass.invite.help")}</p>
          </div>
        ) : (
          <Button
            disabled={busy || left === 0}
            onClick={() =>
              void run(async () => {
                setLink(await createInvitation(config.invitesPerMonth));
                setLeft(remainingInvites(config.invitesPerMonth));
              })
            }
          >
            {busy ? t("pass.invite.proving") : t("pass.invite.create")}
          </Button>
        )}
      </section>

      <details className="rounded-lg border p-4 text-sm">
        <summary className="cursor-pointer font-semibold">{t("pass.backup.title")}</summary>
        <div className="mt-3 space-y-3">
          <p className="text-muted-foreground">{t("pass.backup.text")}</p>
          <Textarea
            readOnly
            value={exportPass() ?? ""}
            rows={2}
            aria-label={t("pass.backup.code")}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (window.confirm(t("pass.remove.confirm"))) forgetPass();
            }}
          >
            {t("pass.remove")}
          </Button>
        </div>
      </details>
    </div>
  );
}

function RestorePass({
  busy,
  run,
}: {
  busy: boolean;
  run: (action: () => Promise<void>) => Promise<void>;
}) {
  const { t } = useI18n();
  const [secret, setSecret] = useState("");
  return (
    <details className="pt-2 text-sm">
      <summary className="cursor-pointer text-muted-foreground">{t("pass.restore.title")}</summary>
      <div className="mt-2 space-y-2">
        <Textarea
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          rows={2}
          aria-label={t("pass.restore.code")}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !secret.trim()}
          onClick={() =>
            void run(async () => {
              await importPass(secret);
              toast.success(t("pass.restored"));
            })
          }
        >
          {t("pass.restore")}
        </Button>
      </div>
    </details>
  );
}
