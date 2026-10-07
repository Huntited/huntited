// ChatPanel : chat de coordination d'une chasse (Matrix, mocké pour l'instant).
// - "active"    → le chat s'ouvrira au seuil
// - "activated" → le salon s'ouvre tout seul ; lien d'accès (et identifiants)
// - "settled"   → salon accessible jusqu'à son expiration (deadline + 24 h)
// - "expired"   → seuil non atteint : aucun salon n'a jamais été créé
// Aucun salon n'est créé avant le statut "activated".
// Privacy-first : aucun log de l'id de chasse, du salon ou du lien d'invitation.
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Hunt, HuntStatus } from "@/lib/types";
import type { SettlementOutcome } from "@/lib/hunt-state-store";
import { ChatLoginBox } from "@/components/hunt/ChatLoginBox";
import { getChat, openChat, type ChatAccess } from "@/lib/chat-client";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { matrixConfig } from "@/lib/matrix-config";
import { useChatAccess } from "@/lib/useChatAccess";

interface ChatPanelProps {
  hunt: Hunt;
  status: HuntStatus;
  outcome?: SettlementOutcome | undefined;
}

export function ChatPanel({ hunt, status, outcome }: ChatPanelProps) {
  const { t, date } = useI18n();
  const [chat, setChat] = useState<ChatAccess | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  // Accès réservé au créateur et aux engagé·es (jeton court en mode API).
  const access = useChatAccess(hunt.id, status, outcome);
  const token = access.getAccessToken();
  const when = (ms: number) => date(ms, { dateStyle: "long", timeStyle: "short" });

  // Le salon reste accessible tant que son expiration n'est pas passée
  // (la vie du chat se poursuit 24 h après la date limite de la chasse).
  const chatAlive = chat !== null && chat.expiresAt > Date.now();

  // Récupère le salon (chasse activée, ou résolue avec un salon encore vivant
  // pendant les 24 h qui suivent la date limite). Le chat s'ouvre tout seul
  // au déclenchement : si le salon manque encore (serveur Matrix indisponible
  // à ce moment-là, ou mode local), on l'ouvre ici, sans clic.
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    // Seuls les statuts post-activation peuvent avoir un salon.
    if (status !== "activated" && status !== "settled") return;
    if (!access.isAuthorized) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    (async () => {
      const existing = await getChat(hunt.id, token);
      if (existing || status !== "activated") return existing;
      // Le salon reste ouvert 24 h après la date limite de la chasse.
      const expiresAt = new Date(hunt.deadline).getTime() + matrixConfig.defaultRoomTtlMs;
      return openChat(hunt, expiresAt, status, outcome, token);
    })()
      .then((res) => {
        if (!cancelled && res) setChat(res);
      })
      .catch(() => {
        if (!cancelled) setError("chat.unavailable");
      })
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
    // `hunt` et `outcome` : seuls l'id et le statut décident d'un nouvel essai.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hunt.id, status, access.isAuthorized, token, attempt]);

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4">
      <h2 className="font-semibold">{t("hunt.chat.title")}</h2>

      {status === "expired" && (
        <p className="text-sm text-muted-foreground">{t("hunt.chat.expired")}</p>
      )}

      {(status === "active" || status === "draft") && (
        <p className="text-sm text-muted-foreground">{t("hunt.chat.later")}</p>
      )}

      {(status === "activated" || status === "settled") && !access.isAuthorized && (
        <p className="text-sm text-muted-foreground">
          {access.isLoading ? t("chat.checking") : t(access.error ?? "chat.connect")}
        </p>
      )}

      {status === "settled" && access.isAuthorized && !isLoading && !chatAlive && (
        <p className="text-sm text-muted-foreground">
          {chat ? t("chat.expiredOn", { date: when(chat.expiresAt) }) : t("chat.neverOpened")}
        </p>
      )}

      {(status === "activated" || status === "settled") && access.isAuthorized && chatAlive && (
        <>
          <p className="text-sm">{t("chat.open")}</p>
          {chat!.login ? (
            <>
              <Button asChild>
                <a href={chat!.inviteLink} target="_blank" rel="noopener noreferrer">
                  {t("chat.openLink")}
                </a>
              </Button>
              <ChatLoginBox login={chat!.login} />
            </>
          ) : (
            // Démonstration (pas de serveur Matrix) : pas de lien vers une
            // adresse qui n'existe pas encore.
            <p role="status" className="rounded-md border bg-muted p-3 text-sm">
              {t("chat.demoRoom")}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {t("chat.expiresOn", { date: when(chat!.expiresAt) })}
          </p>
        </>
      )}

      {status === "activated" && access.isAuthorized && !chat && isLoading && (
        <p className="text-sm text-muted-foreground" role="status">
          {t("chat.opening")}
        </p>
      )}

      {status === "activated" && access.isAuthorized && !chat && !isLoading && error && (
        <>
          <p role="alert" className="text-sm text-destructive">
            {t(error)}
          </p>
          <Button variant="outline" onClick={() => setAttempt((n) => n + 1)}>
            {t("common.retry")}
          </Button>
        </>
      )}

      {/* Sans identifiants, le salon est simulé (front ou serveur en mode mock). */}
      {!chat?.login && !chatAlive && (
        <p className="text-xs text-muted-foreground">{t("chat.demo")}</p>
      )}
    </section>
  );
}
