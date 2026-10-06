import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import type { ChatLogin } from "@/lib/matrix-api";

/**
 * Identifiants temporaires pour se connecter au chat dans Element : compte
 * propre à cette chasse et à cette personne, supprimé avec le salon. Ils ne
 * sont jamais enregistrés sur l'appareil (affichés seulement, à la demande).
 */
export function ChatLoginBox({ login }: { login: ChatLogin }) {
  const { t } = useI18n();
  const [shown, setShown] = useState(false);

  const copy = (value: string) =>
    void navigator.clipboard
      .writeText(value)
      .then(() => toast.success(t("chatLogin.copied")))
      .catch(() => toast.error(t("pass.invite.copyFailed")));

  return (
    <div className="space-y-3 rounded-lg border bg-muted/40 p-3 text-sm">
      <p className="font-medium">{t("chatLogin.title")}</p>
      <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
        <li>{t("chatLogin.step1")}</li>
        <li>{t("chatLogin.step2")}</li>
      </ol>
      <dl className="space-y-2">
        <Field label={t("chatLogin.username")} value={login.username} onCopy={copy} />
        <Field
          label={t("chatLogin.password")}
          value={shown ? login.password : "•".repeat(12)}
          onCopy={() => copy(login.password)}
          extra={
            <Button type="button" variant="ghost" size="sm" onClick={() => setShown((s) => !s)}>
              {t(shown ? "chatLogin.hide" : "chatLogin.show")}
            </Button>
          }
        />
      </dl>
      <p className="text-xs text-muted-foreground">{t("chatLogin.note")}</p>
    </div>
  );
}

function Field({
  label,
  value,
  onCopy,
  extra,
}: {
  label: string;
  value: string;
  onCopy: (v: string) => void;
  extra?: React.ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 flex flex-wrap items-center gap-2">
        <code className="break-all rounded bg-background px-2 py-1 text-xs">{value}</code>
        <Button type="button" variant="outline" size="sm" onClick={() => onCopy(value)}>
          {t("chatLogin.copy")}
        </Button>
        {extra}
      </dd>
    </div>
  );
}
