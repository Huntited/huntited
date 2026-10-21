// Chat chiffré d'une chasse sur la chaîne, sans serveur Huntited
// (src/lib/p2p-chat.ts, docs/chat.md). Membres = clés de chat inscrites sur
// la chaîne ; messages chiffrés, transmis par des relais Nostr publics.
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { createRelayPool, nostrRelays, type RelayPool } from "@/lib/nostr-relays";
import { getChainChat } from "@/lib/onchain/browser-index";
import {
  CHAT_KIND,
  CHAT_TTL_AFTER_DEADLINE_MS,
  chatPublicKey,
  chatTopic,
  getChatKey,
  openMessage,
  sealMessage,
  type ChatMessage,
} from "@/lib/p2p-chat";

type Phase =
  | { kind: "loading" }
  | { kind: "info"; key: MessageKey }
  | { kind: "ready"; priv: string; members: string[]; closesAt: number };

export function P2PChatPanel({ huntId }: { huntId: string }) {
  const { t, date } = useI18n();
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const pool = useRef<RelayPool | null>(null);

  // Membres (sur la chaîne) et clé de ce navigateur.
  useEffect(() => {
    let cancelled = false;
    void getChainChat(huntId)
      .then((chat) => {
        if (cancelled) return;
        const priv = getChatKey(huntId);
        if (!chat) return setPhase({ kind: "info", key: "chat.p2p.unavailable" });
        const closesAt = chat.deadline + CHAT_TTL_AFTER_DEADLINE_MS;
        if (Date.now() > closesAt) return setPhase({ kind: "info", key: "chat.p2p.ended" });
        if (!priv) return setPhase({ kind: "info", key: "chat.p2p.noKey" });
        if (!chat.members.includes(chatPublicKey(priv))) {
          return setPhase({ kind: "info", key: "chat.p2p.notMember" });
        }
        setPhase({ kind: "ready", priv, members: chat.members, closesAt });
      })
      .catch(() => !cancelled && setPhase({ kind: "info", key: "chat.p2p.unavailable" }));
    return () => {
      cancelled = true;
    };
  }, [huntId]);

  // Messages : lus sur les relais, déchiffrés ici.
  const ready = phase.kind === "ready" ? phase : null;
  useEffect(() => {
    if (!ready) return;
    const p = createRelayPool(nostrRelays());
    pool.current = p;
    const stop = p.subscribe({ kinds: [CHAT_KIND], "#h": [chatTopic(huntId)] }, (e) => {
      void openMessage(huntId, ready.priv, ready.members, e).then((m) => {
        if (m) setMessages((all) => add(all, m));
      });
    });
    return () => {
      stop();
      p.close();
      pool.current = null;
    };
    // Une seule connexion par clé et liste de membres.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [huntId, ready?.priv, ready?.members.join()]);

  async function send() {
    if (!ready || !pool.current || !draft.trim()) return;
    setSending(true);
    setError(null);
    try {
      const e = await sealMessage(
        huntId,
        ready.priv,
        ready.members,
        draft,
        ready.closesAt - CHAT_TTL_AFTER_DEADLINE_MS,
      );
      const mine = await openMessage(huntId, ready.priv, ready.members, e);
      await pool.current.publish(e);
      if (mine) setMessages((all) => add(all, mine));
      setDraft("");
    } catch {
      setError("chat.p2p.sendFailed");
    } finally {
      setSending(false);
    }
  }

  const me = ready ? chatPublicKey(ready.priv) : null;
  const who = (author: string) =>
    author === me
      ? t("chat.p2p.you")
      : t("chat.p2p.member", { n: (ready?.members.indexOf(author) ?? 0) + 1 });

  return (
    <section className="space-y-3 rounded-lg border bg-card p-4 text-sm">
      <h2 className="font-semibold">{t("hunt.chat.title")}</h2>
      {phase.kind === "loading" && <p className="text-muted-foreground">{t("chat.p2p.loading")}</p>}
      {phase.kind === "info" && <p className="text-muted-foreground">{t(phase.key)}</p>}
      {ready && (
        <>
          <p className="text-muted-foreground">{t("chat.p2p.intro")}</p>
          <ol className="max-h-96 space-y-2 overflow-y-auto" aria-live="polite">
            {messages.length === 0 && (
              <li className="text-muted-foreground">{t("chat.p2p.empty")}</li>
            )}
            {messages.map((m) => (
              <li key={m.id} className="rounded-md border bg-background p-2">
                <p className="text-xs text-muted-foreground">
                  {who(m.author)} · {date(m.at, { timeStyle: "short", dateStyle: "short" })}
                </p>
                <p className="whitespace-pre-wrap break-words">{m.text}</p>
              </li>
            ))}
          </ol>
          <form
            className="space-y-2"
            onSubmit={(ev) => {
              ev.preventDefault();
              void send();
            }}
          >
            <Textarea
              value={draft}
              onChange={(ev) => setDraft(ev.target.value)}
              placeholder={t("chat.p2p.placeholder")}
              maxLength={2000}
              rows={2}
              aria-label={t("chat.p2p.placeholder")}
            />
            <Button type="submit" disabled={sending || !draft.trim()}>
              {sending ? t("chat.p2p.sending") : t("chat.p2p.send")}
            </Button>
          </form>
          {error && (
            <p role="alert" className="text-destructive">
              {t(error)}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {t("chat.p2p.ends", {
              date: date(ready.closesAt, { dateStyle: "long", timeStyle: "short" }),
            })}
          </p>
        </>
      )}
    </section>
  );
}

/** Ajoute un message (sans doublon), dans l'ordre d'envoi. */
function add(all: ChatMessage[], m: ChatMessage): ChatMessage[] {
  if (all.some((x) => x.id === m.id)) return all;
  return [...all, m].sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
}
