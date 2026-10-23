// Chat chiffré d'une chasse sur la chaîne, sans serveur Huntited
// (src/lib/p2p-chat.ts, docs/chat.md). Membres = clés de chat inscrites sur
// la chaîne ; messages chiffrés, transmis par des relais Nostr publics.
import {
  Bell,
  BellOff,
  Lock,
  Mic,
  Radar,
  Radio,
  SendHorizontal,
  Square,
  Timer,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { APP_PAGE, isAndroid, isInApp, qrSvg, roomIntent, roomLink } from "@/lib/app-link";
import { meshAvailable } from "@/lib/mesh-bridge";
import { Textarea } from "@/components/ui/textarea";
import {
  chatNotifySupported,
  disableChatNotify,
  enableChatNotify,
  isChatNotifyOn,
  onChatNotifyChange,
  setVisibleChat,
} from "@/lib/chat-notify";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { createRelayPool, nostrRelays, type RelayPool } from "@/lib/nostr-relays";
import { getChainChat } from "@/lib/onchain/browser-index";
import {
  CHAT_KIND,
  CHAT_TTL_AFTER_DEADLINE_MS,
  EPHEMERAL_TTLS,
  MAX_AUDIO_MS,
  chatPublicKey,
  chatTopic,
  expired,
  forgetChatKey,
  getChatKey,
  getChatName,
  memberTag,
  openMessage,
  sealMessage,
  setChatName,
  type Audio,
  type ChatMessage,
  type NostrEvent,
  type Presence,
  type RoomSettings,
} from "@/lib/p2p-chat";
import {
  audioSrc,
  createPlayer,
  startRecording,
  voiceSupported,
  type Recording,
} from "@/lib/voice";
import {
  newPresenceKey,
  presenceCount,
  presenceMissing,
  presenceState,
  presenceSupported,
  startPresence,
  stopPresence,
} from "@/lib/presence";

const MAX_TEXT = 2000;
/** Messages d'une même personne à moins de 5 min : un seul nom affiché. */
const GROUP_MS = 5 * 60_000;

type Phase =
  | { kind: "loading" }
  | { kind: "info"; key: MessageKey }
  | {
      kind: "ready";
      priv: string;
      members: string[];
      creator: string | undefined;
      deadline: number;
    };

/** Message affiché : reçu, ou envoyé depuis ici (avec son état d'envoi). */
type Shown = ChatMessage & { status?: "sending" | "failed"; event?: NostrEvent };

export function P2PChatPanel({ huntId, title }: { huntId: string; title: string }) {
  const { t, date, locale } = useI18n();
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [messages, setMessages] = useState<Shown[]>([]);
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState<MessageKey | null>(null);
  // Ton pseudo dans ce chat (au hasard au départ, modifiable).
  const [myName, setMyName] = useState("");
  const [editingName, setEditingName] = useState(false);
  useEffect(() => setMyName(getChatName(huntId, locale)), [huntId, locale]);
  const pool = useRef<RelayPool | null>(null);
  const list = useRef<HTMLOListElement | null>(null);

  // Membres (sur la chaîne) et clé de ce navigateur.
  useEffect(() => {
    let cancelled = false;
    void getChainChat(huntId)
      .then((chat) => {
        if (cancelled) return;
        const priv = getChatKey(huntId);
        if (!chat) return setPhase({ kind: "info", key: "chat.p2p.unavailable" });
        if (Date.now() > chat.deadline + CHAT_TTL_AFTER_DEADLINE_MS) {
          return setPhase({ kind: "info", key: "chat.p2p.ended" });
        }
        if (!priv) return setPhase({ kind: "info", key: "chat.p2p.noKey" });
        if (!chat.members.includes(chatPublicKey(priv))) {
          return setPhase({ kind: "info", key: "chat.p2p.notMember" });
        }
        setPhase({
          kind: "ready",
          priv,
          members: chat.members,
          creator: chat.creator,
          deadline: chat.deadline,
        });
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
    setVisibleChat(huntId); // pas de notification pour le chat affiché
    const stop = p.subscribe({ kinds: [CHAT_KIND], "#h": [chatTopic(huntId)] }, (e) => {
      void openMessage(huntId, ready.priv, ready.members, e).then((m) => {
        if (m) setMessages((all) => upsert(all, m));
      });
    });
    return () => {
      stop();
      p.close();
      pool.current = null;
      setVisibleChat(null);
    };
    // Une seule connexion par clé et liste de membres.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [huntId, ready?.priv, ready?.members.join()]);

  // Messages éphémères : réglage du créateur (son dernier message qui en porte un).
  const roomTtl =
    messages.filter((m) => m.room && m.author === ready?.creator).at(-1)?.room?.ttl ?? 0;
  // Horloge pour faire disparaître les messages éphémères à l'heure.
  const [now, setNow] = useState(() => Date.now());
  const hasExp = messages.some((m) => m.exp !== undefined);
  useEffect(() => {
    if (!hasExp) return;
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, [hasExp]);

  // Messages affichés (ceux qui ne portent que la clé de présence sont cachés,
  // les éphémères disparaissent à expiration).
  const visible = messages.filter((m) => (m.text || m.audio) && !expired(m, now));

  // Défile vers le bas à l'arrivée d'un message (si on était déjà en bas,
  // ou si c'est le sien).
  const last = visible.at(-1);
  const me = ready ? chatPublicKey(ready.priv) : null;

  // Compteur de présence (src/lib/presence.ts) : clé commune du salon.
  const presence = ready ? presenceState(messages, ready.creator) : null;
  const [around, setAround] = useState<number | null>(null);
  // Pas encore de clé, une fois l'historique chargé : ce membre en crée une.
  useEffect(() => {
    if (!ready || presence) return;
    const timer = setTimeout(() => void post("", { presence: { key: newPresenceKey() } }), 15_000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready?.priv, presence?.key]);
  // Membres arrivés après : on leur renvoie la clé (une fois par visite).
  const resent = useRef(false);
  useEffect(() => {
    if (!ready || !presence || !me || resent.current) return;
    if (presenceMissing(presence, messages, ready.members, me).length === 0) return;
    resent.current = true;
    void post("", {
      presence: { key: presence.key, ...(presence.onsite ? { onsite: presence.onsite } : {}) },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presence?.from.id, ready?.members.join()]);
  // Dans l'app : signal « je suis là » et compte des membres autour.
  useEffect(() => {
    if (!ready || !presence || !presenceSupported()) return;
    startPresence(huntId, title, presence, ready.priv, ready.deadline + CHAT_TTL_AFTER_DEADLINE_MS);
    const tick = () => setAround(presenceCount(huntId));
    tick();
    const timer = setInterval(tick, 5_000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [huntId, ready?.priv, presence?.key, presence?.onsite]);
  useEffect(() => {
    const el = list.current;
    if (!el || !last) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (nearBottom || last.author === me) el.scrollTop = el.scrollHeight;
  }, [last, me]);

  async function deliver(e: NostrEvent) {
    setMessages((all) => all.map((m) => (m.id === e.id ? { ...m, status: "sending" } : m)));
    try {
      if (!pool.current) throw new Error("no_relays");
      await pool.current.publish(e);
      setMessages((all) =>
        all.map((m) => {
          if (m.id !== e.id) return m;
          const { status: _s, event: _e, ...sent } = m;
          return sent;
        }),
      );
    } catch {
      setMessages((all) => all.map((m) => (m.id === e.id ? { ...m, status: "failed" } : m)));
    }
  }

  async function post(
    text: string,
    extra: { bitchat?: string; presence?: Presence; audio?: Audio; room?: RoomSettings } = {},
  ) {
    if (!ready || (!text.trim() && !extra.presence && !extra.audio && !extra.room)) return false;
    const e = await sealMessage(huntId, ready.priv, ready.members, text, ready.deadline, {
      name: myName,
      // Clé de présence et réglages : gardés jusqu'à la fermeture du salon.
      ttl: extra.presence || extra.room ? 0 : roomTtl,
      ...extra,
    });
    const mine = await openMessage(huntId, ready.priv, ready.members, e);
    if (!mine) return false;
    // Affiché tout de suite, avec son état d'envoi.
    setMessages((all) => upsert(all, { ...mine, status: "sending", event: e }));
    await deliver(e);
    return true;
  }

  async function send() {
    const text = draft;
    setDraft("");
    if (!(await post(text))) setDraft(text);
  }

  // Plan B sans réseau : pseudos bitchat partagés par les membres (dernier connu).
  const bitchatOf = new Map<string, string>();
  for (const m of messages) if (m.bitchat) bitchatOf.set(m.author, m.bitchat);

  function onKeyDown(ev: KeyboardEvent<HTMLTextAreaElement>) {
    if (ev.key === "Enter" && !ev.shiftKey && !ev.nativeEvent.isComposing) {
      ev.preventDefault();
      void send();
    }
  }

  // Dernier pseudo de chaque membre (un pseudo peut changer ; la marque #XXXX, non).
  const names = new Map<string, string>();
  for (const m of messages) if (m.name) names.set(m.author, m.name);
  const who = (author: string) => {
    const others = ready?.members.filter((m) => m !== ready.creator) ?? [];
    const fallback =
      author === ready?.creator
        ? t("chat.p2p.creator")
        : t("chat.p2p.member", { n: others.indexOf(author) + 1 });
    return names.get(author) ?? fallback;
  };
  const when = (at: number) =>
    new Date(at).toDateString() === new Date().toDateString()
      ? date(at, { timeStyle: "short" })
      : date(at, { dateStyle: "short", timeStyle: "short" });

  return (
    <section className="space-y-3 rounded-lg border bg-card p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">{t("hunt.chat.title")}</h2>
        {ready && <NotifyToggle huntId={huntId} title={title} onNotice={setNotice} />}
      </div>

      {phase.kind === "loading" && (
        <p className="text-muted-foreground" role="status">
          {t("chat.p2p.loading")}
        </p>
      )}
      {phase.kind === "info" && <p className="text-muted-foreground">{t(phase.key)}</p>}

      {ready && (
        <>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="size-3.5 shrink-0" aria-hidden />
            {t("chat.p2p.secure")}
          </p>

          <ol
            ref={list}
            className="h-80 space-y-1 overflow-y-auto rounded-md border bg-background p-3"
            aria-live="polite"
            aria-label={t("hunt.chat.title")}
          >
            {visible.length === 0 && (
              <li className="flex h-full items-center justify-center text-muted-foreground">
                {t("chat.p2p.empty")}
              </li>
            )}
            {visible.map((m, i) => {
              const mine = m.author === me;
              const prev = visible[i - 1];
              const grouped = prev?.author === m.author && m.at - prev.at < GROUP_MS;
              return (
                <li
                  key={m.id}
                  className={`flex flex-col ${mine ? "items-end" : "items-start"} ${grouped ? "" : "pt-2"}`}
                >
                  {!grouped && !mine && (
                    <span className="mb-0.5 flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{who(m.author)}</span>
                      <span className="font-mono">{memberTag(m.author)}</span>
                      {m.author === ready.creator && names.has(m.author) && (
                        <span className="rounded border px-1 text-[10px] uppercase tracking-wide">
                          {t("chat.p2p.creator")}
                        </span>
                      )}
                    </span>
                  )}
                  {m.audio && (
                    <div
                      className={`flex max-w-[85%] items-center gap-1.5 ${m.status === "sending" ? "opacity-60" : ""}`}
                    >
                      {m.audio.ptt && (
                        <Radio
                          className="size-4 shrink-0 text-muted-foreground"
                          aria-label={t("chat.p2p.talkie.label")}
                        />
                      )}
                      <audio
                        controls
                        preload="none"
                        src={audioSrc(m.audio)}
                        className="h-9 max-w-full"
                        aria-label={t("chat.p2p.voice.label", { s: Math.round(m.audio.ms / 1000) })}
                      />
                    </div>
                  )}
                  {m.text && (
                    <p
                      className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 ${
                        mine ? "bg-primary text-primary-foreground" : "bg-muted"
                      } ${m.status === "sending" ? "opacity-60" : ""}`}
                    >
                      {m.text}
                    </p>
                  )}
                  <span className="mt-0.5 px-1 text-[11px] text-muted-foreground">
                    {m.status === "sending" ? (
                      t("chat.p2p.sending")
                    ) : m.status === "failed" ? (
                      <span className="text-destructive">
                        {t("chat.p2p.failed")} ·{" "}
                        <button
                          type="button"
                          className="underline underline-offset-2"
                          onClick={() => m.event && void deliver(m.event)}
                        >
                          {t("common.retry")}
                        </button>
                      </span>
                    ) : (
                      when(m.at)
                    )}
                  </span>
                </li>
              );
            })}
          </ol>

          {editingName ? (
            <form
              className="space-y-1"
              onSubmit={(ev) => {
                ev.preventDefault();
                setMyName(setChatName(huntId, myName));
                setEditingName(false);
              }}
            >
              <label htmlFor="chat-name" className="text-xs font-medium">
                {t("chat.p2p.nameLabel")}
              </label>
              <div className="flex gap-2">
                <Input
                  id="chat-name"
                  value={myName}
                  onChange={(ev) => setMyName(ev.target.value)}
                  maxLength={30}
                  autoFocus
                  className="h-8"
                />
                <Button type="submit" size="sm">
                  {t("chat.p2p.save")}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{t("chat.p2p.nameHint")}</p>
            </form>
          ) : (
            <p className="text-xs text-muted-foreground">
              {t("chat.p2p.as")} <span className="font-medium text-foreground">{myName}</span>{" "}
              <span className="font-mono">{me && memberTag(me)}</span> ·{" "}
              <button
                type="button"
                className="underline underline-offset-2"
                onClick={() => setEditingName(true)}
              >
                {t("chat.p2p.rename")}
              </button>
            </p>
          )}
          <form
            className="flex items-end gap-2"
            onSubmit={(ev) => {
              ev.preventDefault();
              void send();
            }}
          >
            <Textarea
              value={draft}
              onChange={(ev) => setDraft(ev.target.value)}
              onKeyDown={onKeyDown}
              placeholder={t("chat.p2p.placeholder")}
              aria-label={t("chat.p2p.placeholder")}
              maxLength={MAX_TEXT}
              rows={1}
              className="max-h-40 min-h-10 resize-none"
            />
            {!draft.trim() && voiceSupported() ? (
              <VoiceButton onRecorded={(audio) => post("", { audio })} />
            ) : (
              <Button
                type="submit"
                size="icon"
                disabled={!draft.trim()}
                aria-label={t("chat.p2p.send")}
                title={t("chat.p2p.send")}
              >
                <SendHorizontal aria-hidden />
              </Button>
            )}
          </form>
          {isInApp() && voiceSupported() && (
            <TalkieBox
              messages={messages}
              me={me}
              onTalk={(audio) => post("", { audio: { ...audio, ptt: true } })}
            />
          )}
          <p className="flex justify-between gap-2 text-xs text-muted-foreground">
            <span className="hidden sm:inline">{t("chat.p2p.keyHint")}</span>
            {draft.length > MAX_TEXT - 200 && (
              <span>{t("chat.p2p.charsLeft", { n: MAX_TEXT - draft.length })}</span>
            )}
          </p>
          {notice && (
            <p role="alert" className="text-xs text-destructive">
              {t(notice)}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {t("chat.p2p.ends", {
              date: date(ready.deadline + CHAT_TTL_AFTER_DEADLINE_MS, {
                dateStyle: "long",
                timeStyle: "short",
              }),
            })}
          </p>
          {isInApp() && (
            <p className="text-xs text-muted-foreground">
              {t(meshAvailable() ? "chat.p2p.mesh.on" : "chat.p2p.mesh.off")}
            </p>
          )}
          <EphemeralSetting
            ttl={roomTtl}
            isCreator={me !== null && me === ready.creator}
            onChange={(ttl) =>
              post(
                ttl
                  ? t("chat.p2p.ephemeral.announce", { d: t(ttlKey(ttl)) })
                  : t("chat.p2p.ephemeral.announceOff"),
                { room: { ttl } },
              )
            }
          />
          <PresenceBox
            around={around}
            onsite={presence?.onsite}
            isCreator={me !== null && me === ready.creator}
            onSetOnsite={(n) =>
              post(t("chat.p2p.presence.announce", { n }), {
                presence: { key: presence?.key ?? newPresenceKey(), onsite: n },
              })
            }
          />
          {/* Dans l'app elle-même, inutile de proposer de l'ouvrir. */}
          {!isInApp() && <OpenInApp huntId={huntId} priv={ready.priv} />}
          <PlanB
            contacts={[...bitchatOf].map(([author, nick]) => ({
              who: author === me ? t("chat.p2p.you") : who(author),
              tag: memberTag(author),
              nick,
            }))}
            onShare={(nick) => post(t("chat.p2p.bitchat.shared", { nick }), { bitchat: nick })}
          />
          <p className="text-xs">
            <button
              type="button"
              className="text-muted-foreground underline underline-offset-2"
              onClick={() => {
                if (!window.confirm(t("chat.p2p.forget.confirm"))) return;
                forgetChatKey(huntId);
                stopPresence(huntId);
                setMessages([]);
                setPhase({ kind: "info", key: "chat.p2p.forget.done" });
              }}
            >
              {t("chat.p2p.forget.button")}
            </button>
          </p>
        </>
      )}
    </section>
  );
}

const ttlKey = (ttl: number): MessageKey =>
  ttl >= 24 * 3_600_000
    ? "chat.p2p.ephemeral.24h"
    : ttl >= 6 * 3_600_000
      ? "chat.p2p.ephemeral.6h"
      : ttl > 0
        ? "chat.p2p.ephemeral.1h"
        : "chat.p2p.ephemeral.off";

/**
 * Messages éphémères : le créateur choisit combien de temps chaque message
 * reste (1 h, 6 h, 24 h) ; sinon, jusqu'à la fermeture du salon.
 */
function EphemeralSetting({
  ttl,
  isCreator,
  onChange,
}: {
  ttl: number;
  isCreator: boolean;
  onChange: (ttl: number) => Promise<boolean>;
}) {
  const { t } = useI18n();
  if (!isCreator) {
    return ttl > 0 ? (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Timer className="size-3.5 shrink-0" aria-hidden />
        {t("chat.p2p.ephemeral.on", { d: t(ttlKey(ttl)) })}
      </p>
    ) : null;
  }
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <Timer className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <label htmlFor="ephemeral" className="text-muted-foreground">
        {t("chat.p2p.ephemeral.label")}
      </label>
      <select
        id="ephemeral"
        value={ttl}
        onChange={(ev) => void onChange(Number(ev.target.value))}
        className="h-8 rounded-md border bg-background px-2"
      >
        {EPHEMERAL_TTLS.map((d) => (
          <option key={d} value={d}>
            {t(ttlKey(d))}
          </option>
        ))}
      </select>
    </div>
  );
}

const TALK_MS = 15_000;
const clock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Message vocal : un appui pour enregistrer (30 s au plus), un autre pour envoyer. */
function VoiceButton({ onRecorded }: { onRecorded: (a: Audio) => Promise<boolean> }) {
  const { t } = useI18n();
  const rec = useRef<Recording | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [denied, setDenied] = useState(false);
  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setElapsed(rec.current?.elapsed() ?? 0), 250);
    return () => clearInterval(timer);
  }, [recording]);
  useEffect(() => () => rec.current?.cancel(), []);

  async function start() {
    setDenied(false);
    try {
      rec.current = await startRecording(MAX_AUDIO_MS, () => void finish());
      setElapsed(0);
      setRecording(true);
    } catch {
      setDenied(true);
    }
  }
  async function finish() {
    const r = rec.current;
    rec.current = null;
    setRecording(false);
    const audio = await r?.stop();
    if (audio) await onRecorded(audio);
  }
  function cancel() {
    rec.current?.cancel();
    rec.current = null;
    setRecording(false);
  }

  if (recording) {
    return (
      <div className="flex items-center gap-1">
        <span
          role="status"
          className="flex items-center gap-1 text-xs tabular-nums text-destructive"
        >
          <span className="size-2 animate-pulse rounded-full bg-destructive" aria-hidden />
          {clock(elapsed)}
        </span>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={cancel}
          aria-label={t("chat.p2p.voice.cancel")}
          title={t("chat.p2p.voice.cancel")}
        >
          <X aria-hidden />
        </Button>
        <Button
          type="button"
          size="icon"
          onClick={() => void finish()}
          aria-label={t("chat.p2p.voice.send")}
          title={t("chat.p2p.voice.send")}
        >
          <Square aria-hidden />
        </Button>
      </div>
    );
  }
  return (
    <Button
      type="button"
      size="icon"
      variant={denied ? "destructive" : "default"}
      onClick={() => void start()}
      aria-label={denied ? t("chat.p2p.voice.denied") : t("chat.p2p.voice.record")}
      title={denied ? t("chat.p2p.voice.denied") : t("chat.p2p.voice.record")}
    >
      <Mic aria-hidden />
    </Button>
  );
}

/**
 * Talkie-walkie (dans l'app) : maintenir pour parler (15 s au plus) ; le son
 * part dès qu'on relâche, par Bluetooth et par les relais, et se joue tout
 * de suite chez les membres qui écoutent.
 */
function TalkieBox({
  messages,
  me,
  onTalk,
}: {
  messages: ChatMessage[];
  me: string | null;
  onTalk: (a: Audio) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const [on, setOn] = useState(false);
  const [talking, setTalking] = useState(false);
  const [denied, setDenied] = useState(false);
  const played = useRef(new Set<string>());
  const player = useRef<ReturnType<typeof createPlayer> | null>(null);
  const rec = useRef<Recording | null>(null);
  const released = useRef(true);

  // Joue les nouveaux messages talkie-walkie des autres membres.
  useEffect(() => {
    if (!on) return;
    player.current ??= createPlayer();
    for (const m of messages) {
      if (played.current.has(m.id)) continue;
      played.current.add(m.id);
      if (m.audio?.ptt && m.author !== me) player.current.play(m.audio);
    }
  }, [messages, on, me]);
  useEffect(
    () => () => {
      player.current?.stop();
      rec.current?.cancel();
    },
    [],
  );

  function toggle() {
    if (on) {
      player.current?.stop();
      setOn(false);
      return;
    }
    // Seulement ce qui arrive à partir de maintenant.
    for (const m of messages) played.current.add(m.id);
    setOn(true);
  }
  async function down() {
    if (rec.current || talking) return;
    released.current = false;
    setDenied(false);
    player.current?.stop();
    try {
      rec.current = await startRecording(TALK_MS, () => void up());
      setTalking(true);
      if (released.current) void up(); // relâché pendant l'ouverture du micro
    } catch {
      setDenied(true);
    }
  }
  async function up() {
    released.current = true;
    const r = rec.current;
    if (!r) return;
    rec.current = null;
    setTalking(false);
    const audio = await r.stop();
    if (audio) await onTalk(audio);
  }

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 font-medium">
          <Radio className="size-4 shrink-0" aria-hidden />
          {t("chat.p2p.talkie.title")}
        </p>
        <Button size="sm" variant={on ? "secondary" : "outline"} aria-pressed={on} onClick={toggle}>
          {on ? t("chat.p2p.talkie.listening") : t("chat.p2p.talkie.listen")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t("chat.p2p.talkie.hint")}</p>
      {on && (
        <button
          type="button"
          onPointerDown={() => void down()}
          onPointerUp={() => void up()}
          onPointerCancel={() => void up()}
          onKeyDown={(ev) => (ev.key === " " || ev.key === "Enter") && !ev.repeat && void down()}
          onKeyUp={(ev) => (ev.key === " " || ev.key === "Enter") && void up()}
          onContextMenu={(ev) => ev.preventDefault()}
          className={`w-full touch-none select-none rounded-full py-6 text-base font-semibold ${
            talking
              ? "bg-destructive text-destructive-foreground"
              : "bg-primary text-primary-foreground"
          }`}
        >
          {talking ? t("chat.p2p.talkie.talking") : t("chat.p2p.talkie.hold")}
        </button>
      )}
      {denied && (
        <p role="alert" className="text-xs text-destructive">
          {t("chat.p2p.voice.denied")}
        </p>
      )}
    </div>
  );
}

/**
 * Présence sur place (src/lib/presence.ts) : dans l'app, les membres de la
 * chasse comptés autour de soi par Bluetooth, et le seuil sur place fixé par
 * le créateur.
 */
function PresenceBox({
  around,
  onsite,
  isCreator,
  onSetOnsite,
}: {
  around: number | null;
  onsite: number | undefined;
  isCreator: boolean;
  onSetOnsite: (n: number) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState("");
  const reached = around !== null && onsite !== undefined && around >= onsite;

  return (
    <div className="space-y-2 rounded-md border p-3" aria-live="polite">
      <p className="flex items-center gap-1.5 font-medium">
        <Radar className="size-4 shrink-0" aria-hidden />
        {t("chat.p2p.presence.title")}
      </p>
      {around !== null ? (
        <p>{t("chat.p2p.presence.around", { n: around })}</p>
      ) : (
        <p className="text-xs text-muted-foreground">{t("chat.p2p.presence.app")}</p>
      )}
      {onsite !== undefined && (
        <>
          <p className="text-xs text-muted-foreground">
            {around !== null
              ? t("chat.p2p.presence.progress", { n: around, onsite })
              : t("chat.p2p.presence.threshold", { onsite })}
          </p>
          {around !== null && (
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full ${reached ? "bg-green-600" : "bg-primary"}`}
                style={{ width: `${Math.min(100, (around / onsite) * 100)}%` }}
              />
            </div>
          )}
          {reached && (
            <p role="status" className="font-semibold text-green-700 dark:text-green-400">
              {t("chat.p2p.presence.go", { n: around })}
            </p>
          )}
        </>
      )}
      {isCreator && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(ev) => {
            ev.preventDefault();
            const n = Number(draft);
            if (!Number.isInteger(n) || n < 2 || n > 100_000) return;
            void onSetOnsite(n).then((ok) => ok && setDraft(""));
          }}
        >
          <div className="space-y-1">
            <label htmlFor="onsite" className="text-xs font-medium">
              {t("chat.p2p.presence.set")}
            </label>
            <Input
              id="onsite"
              type="number"
              min={2}
              value={draft}
              onChange={(ev) => setDraft(ev.target.value)}
              className="h-8 w-28"
            />
          </div>
          <Button type="submit" size="sm" variant="outline">
            {t("chat.p2p.presence.define")}
          </Button>
        </form>
      )}
      <p className="text-[11px] text-muted-foreground">{t("chat.p2p.presence.note")}</p>
    </div>
  );
}

/** Bouton « me prévenir des nouveaux messages » (notifications du navigateur). */
function NotifyToggle({
  huntId,
  title,
  onNotice,
}: {
  huntId: string;
  title: string;
  onNotice: (k: MessageKey | null) => void;
}) {
  const { t } = useI18n();
  const [on, setOn] = useState(false);
  useEffect(() => {
    const read = () => setOn(isChatNotifyOn(huntId));
    read();
    return onChatNotifyChange(read);
  }, [huntId]);
  if (!chatNotifySupported()) return null;

  async function toggle() {
    onNotice(null);
    if (on) return disableChatNotify(huntId);
    const res = await enableChatNotify(huntId, title);
    if (res === "denied") onNotice("chat.p2p.notifyDenied");
  }

  return (
    <>
      <Button
        variant={on ? "secondary" : "outline"}
        size="sm"
        onClick={() => void toggle()}
        aria-pressed={on}
        title={t("chat.p2p.notifyHint")}
      >
        {on ? <Bell aria-hidden /> : <BellOff aria-hidden />}
        {on ? t("chat.p2p.notifyActive") : t("chat.p2p.notifyOn")}
      </Button>
      {on && (
        <span className="w-full text-xs text-muted-foreground">{t("chat.p2p.notifyHint")}</span>
      )}
    </>
  );
}

/**
 * Ouvrir ce salon dans l'app Huntited Chat (Android) : lien direct sur
 * téléphone, QR code depuis un ordinateur. Le lien contient la clé de chat :
 * affiché seulement à la demande, avec un avertissement.
 */
function OpenInApp({ huntId, priv }: { huntId: string; priv: string }) {
  const { t } = useI18n();
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);
  const link = roomLink(huntId, priv);
  return (
    <details className="rounded-md border p-3">
      <summary className="cursor-pointer font-medium">{t("chat.app.title")}</summary>
      <div className="mt-2 space-y-2 text-xs text-muted-foreground">
        <p>{t("chat.app.lead")}</p>
        {isAndroid() && (
          <Button asChild size="sm">
            <a href={roomIntent(huntId, priv)}>{t("chat.app.open")}</a>
          </Button>
        )}
        {!shown ? (
          <Button size="sm" variant="outline" onClick={() => setShown(true)}>
            {t("chat.app.showQr")}
          </Button>
        ) : (
          <>
            <p className="font-medium text-destructive">{t("chat.app.warning")}</p>
            <div
              className="size-48 rounded-md bg-white p-2"
              role="img"
              aria-label={t("chat.app.qrLabel")}
              // QR généré localement (qrcode-generator), aucune donnée envoyée.
              dangerouslySetInnerHTML={{ __html: qrSvg(link) }}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => void navigator.clipboard.writeText(link).then(() => setCopied(true))}
            >
              {copied ? t("chatLogin.copied") : t("chat.app.copy")}
            </Button>
          </>
        )}
        <p>
          <a
            href={APP_PAGE}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-foreground underline underline-offset-2"
          >
            {t("chat.app.install")} ↗
          </a>
        </p>
      </div>
    </details>
  );
}

/**
 * Plan B si le réseau coupe le jour J : bitchat (Bluetooth, de téléphone à
 * téléphone). Chacun partage son pseudo bitchat dans ce chat chiffré, pour
 * pouvoir s'écrire en privé sans internet (docs/chat.md).
 */
function PlanB({
  contacts,
  onShare,
}: {
  contacts: { who: string; tag: string; nick: string }[];
  onShare: (nick: string) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const [nick, setNick] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <details className="rounded-md border p-3">
      <summary className="cursor-pointer font-medium">{t("chat.p2p.bitchat.title")}</summary>
      <div className="mt-2 space-y-2 text-xs text-muted-foreground">
        <p>{t("chat.p2p.bitchat.lead")}</p>
        <p className="flex flex-wrap gap-x-4">
          <a
            href="https://apps.apple.com/us/app/bitchat-mesh/id6748219622"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-foreground underline underline-offset-2"
          >
            bitchat (iPhone) ↗
          </a>
          <a
            href="https://play.google.com/store/apps/details?id=com.bitchat.droid"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-foreground underline underline-offset-2"
          >
            bitchat (Android) ↗
          </a>
        </p>
        <form
          className="flex gap-2"
          onSubmit={(ev) => {
            ev.preventDefault();
            if (!nick.trim()) return;
            setBusy(true);
            void onShare(nick.trim()).finally(() => {
              setBusy(false);
              setNick("");
            });
          }}
        >
          <Input
            value={nick}
            onChange={(ev) => setNick(ev.target.value)}
            maxLength={30}
            placeholder={t("chat.p2p.bitchat.placeholder")}
            aria-label={t("chat.p2p.bitchat.placeholder")}
            className="h-8"
          />
          <Button type="submit" size="sm" variant="outline" disabled={busy || !nick.trim()}>
            {t("chat.p2p.bitchat.share")}
          </Button>
        </form>
        {contacts.length > 0 && (
          <ul className="space-y-0.5">
            {contacts.map((c) => (
              <li key={c.tag}>
                {c.who} <span className="font-mono">{c.tag}</span> :{" "}
                <span className="font-medium text-foreground">{c.nick}</span>
              </li>
            ))}
          </ul>
        )}
        <p>{t("chat.p2p.bitchat.warning")}</p>
      </div>
    </details>
  );
}

/** Ajoute ou met à jour un message (sans doublon), dans l'ordre d'envoi. */
function upsert(all: Shown[], m: Shown): Shown[] {
  const i = all.findIndex((x) => x.id === m.id);
  if (i >= 0) return all;
  return [...all, m].sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
}
