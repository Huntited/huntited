// ChatPanel : chat de coordination d'une chasse (Matrix, mocké pour l'instant).
// - "active"    → le chat s'ouvrira au seuil
// - "activated" → on vérifie l'état du salon ; bouton d'activation ou lien d'accès
// - "settled"   → salon accessible jusqu'à son expiration (deadline + 24 h)
// - "expired"   → seuil non atteint : aucun salon n'a jamais été créé
// Aucun salon n'est créé avant le statut "activated".
// Privacy-first : aucun log de l'id de chasse, du salon ou du lien d'invitation.
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Hunt, HuntStatus } from "@/lib/types";
import type { SettlementOutcome } from "@/lib/hunt-state-store";
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

  // Vérifie l'état du salon au montage (chasse activée, ou expirée avec un
  // salon encore vivant pendant les 24 h qui suivent la date limite).
  useEffect(() => {
    // Seuls les statuts post-activation peuvent avoir un salon.
    if (status !== "activated" && status !== "settled") return;
    if (!access.isAuthorized) return;
    let cancelled = false;
    setIsLoading(true);
    getChat(hunt.id, token)
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
  }, [hunt.id, status, access.isAuthorized, token]);

  async function handleActivate() {
    setIsLoading(true);
    setError(null);
    try {
      // Le salon reste ouvert 24 h après la date limite de la chasse
      // (expiresAt = huntDeadline + defaultRoomTtlMs).
      const expiresAt = new Date(hunt.deadline).getTime() + matrixConfig.defaultRoomTtlMs;
      setChat(await openChat(hunt, expiresAt, status, outcome, token));
    } catch {
      setError("chat.unavailable");
    } finally {
      setIsLoading(false);
    }
  }

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
          <Button asChild>
            <a href={chat!.inviteLink} target="_blank" rel="noopener noreferrer">
              {t("chat.openLink")}
            </a>
          </Button>
          <p className="text-xs text-muted-foreground">
            {t("chat.expiresOn", { date: when(chat!.expiresAt) })}
          </p>
        </>
      )}

      {status === "activated" &&
        access.isAuthorized &&
        access.role === "participant" &&
        !chat &&
        !isLoading && (
          <p className="text-sm text-muted-foreground">{t(error ?? "chat.waitCreator")}</p>
        )}

      {status === "activated" && access.isAuthorized && access.role === "creator" && !chat && (
        <>
          <p className="text-sm">{t("chat.creatorActivate")}</p>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {t(error)}
            </p>
          )}
          <Button onClick={handleActivate} disabled={isLoading}>
            {isLoading ? t("common.loading") : t("chat.activate")}
          </Button>
        </>
      )}

      <p className="text-xs text-muted-foreground">{t("chat.demo")}</p>
    </section>
  );
}
