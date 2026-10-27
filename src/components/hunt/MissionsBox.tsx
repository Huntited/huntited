// Missions du salon (src/lib/missions.ts, docs/missions.md) : le créateur lance
// une mission ; chacun la prouve par le code de présence (QR sur place, code
// dit en ligne), par la vérification de trois autres membres, en signant
// la lettre collective, ou par un retweet ou commentaire sur X.
import { Check, Copy, Download, PenLine, Target, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { XPart, type XCrypt } from "@/components/hunt/XMissionPart";
import { qrSvg } from "@/lib/app-link";
import { useI18n } from "@/lib/i18n";
import {
  CODE_WINDOW_MS,
  HOLD_DAYS,
  MAX_LETTER,
  codeHash,
  codeProof,
  newCode,
  newMissionId,
  normalizeCode,
  shortId,
  signedLetter,
  xPostUrl,
  type Mission,
  type MissionKind,
  type MissionMsg,
  type XAction,
} from "@/lib/missions";

const DAY = 86_400_000;

const CODES = "huntited:mission-codes";

function savedCode(id: string): string | null {
  try {
    return (JSON.parse(localStorage.getItem(CODES) ?? "{}") as Record<string, string>)[id] ?? null;
  } catch {
    return null;
  }
}
function saveCode(id: string, code: string) {
  try {
    const all = JSON.parse(localStorage.getItem(CODES) ?? "{}") as Record<string, string>;
    localStorage.setItem(CODES, JSON.stringify({ ...all, [id]: code }));
  } catch {
    /* code gardé pour cette visite seulement */
  }
}

type Post = (text: string, mission: MissionMsg) => Promise<boolean>;

export function MissionsBox({
  huntId,
  missions,
  me,
  isCreator,
  nameOf,
  prefillCode,
  members,
  closesAt,
  crypt,
  onPost,
}: {
  huntId: string;
  missions: Mission[];
  me: string;
  isCreator: boolean;
  nameOf: (author: string) => string;
  prefillCode?: string;
  /** Membres du salon (tirage des vérificateurs). */
  members: string[];
  /** Fermeture du salon (ms) : le délai de maintien d'une mission X doit tenir avant. */
  closesAt: number;
  crypt: XCrypt;
  onPost: Post;
}) {
  const { t } = useI18n();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!isCreator && missions.length === 0) return null;
  return (
    <div className="space-y-3 rounded-md border p-3">
      <p className="flex items-center gap-1.5 font-medium">
        <Target className="size-4 shrink-0" aria-hidden />
        {t("mission.title")}
      </p>
      {missions.map((m) => (
        <MissionCard
          key={m.id}
          huntId={huntId}
          mission={m}
          me={me}
          isCreator={isCreator}
          nameOf={nameOf}
          now={now}
          {...(prefillCode ? { prefillCode } : {})}
          members={members}
          crypt={crypt}
          onPost={onPost}
        />
      ))}
      {isCreator && <NewMission onPost={onPost} closesAt={closesAt} />}
    </div>
  );
}

function NewMission({ onPost, closesAt }: { onPost: Post; closesAt: number }) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [kind, setKind] = useState<MissionKind>("code");
  const [target, setTarget] = useState("");
  const [action, setAction] = useState<XAction>("retweet");
  const [holdDays, setHoldDays] = useState<number>(HOLD_DAYS[0]);
  const [busy, setBusy] = useState(false);
  // Délais possibles : l'action doit être contrôlable avant la fermeture du salon.
  const holds = HOLD_DAYS.filter((d) => Date.now() + d * DAY + DAY <= closesAt);
  const post = kind === "x" ? xPostUrl(target) : null;
  const ready = !!text.trim() && (kind !== "x" || (!!post && holds.includes(holdDays as never)));
  return (
    <form
      className="space-y-2 border-t pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready || busy) return;
        setBusy(true);
        const announce =
          kind === "sign"
            ? t("mission.announceLetter", { text: text.trim().split("\n")[0]!.slice(0, 120) })
            : t("mission.announce", { text: text.trim() });
        void onPost(announce, {
          t: "create",
          id: newMissionId(),
          text: text.trim(),
          kind,
          ...(kind === "x" ? { target: post!, action, hold: holdDays * DAY } : {}),
        })
          .then((ok) => ok && setText(""))
          .finally(() => setBusy(false));
      }}
    >
      <label htmlFor="mission-text" className="text-xs font-medium">
        {t("mission.new")}
      </label>
      <Textarea
        id="mission-text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={kind === "sign" ? MAX_LETTER : 500}
        rows={kind === "sign" ? 8 : 2}
        placeholder={t(kind === "sign" ? "mission.letterPlaceholder" : "mission.placeholder")}
      />
      <div className="space-y-1 text-xs">
        {(["code", "peer", "sign", "x"] as const).map((k) => (
          <label key={k} className="flex items-start gap-2">
            <input
              type="radio"
              name="mission-kind"
              checked={kind === k}
              onChange={() => setKind(k)}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium">{t(`mission.kind.${k}`)}</span>
              <span className="block text-muted-foreground">{t(`mission.kindHint.${k}`)}</span>
            </span>
          </label>
        ))}
      </div>
      {kind === "x" && (
        <div className="space-y-2 rounded border p-2 text-xs">
          <label htmlFor="mission-target" className="font-medium">
            {t("mission.x.target")}
          </label>
          <Input
            id="mission-target"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            inputMode="url"
            autoComplete="off"
            placeholder="https://x.com/…/status/…"
            className="h-9"
          />
          {target.trim() && !post && (
            <p role="alert" className="text-destructive">
              {t("mission.x.badTarget")}
            </p>
          )}
          <fieldset className="flex flex-wrap gap-3">
            <legend className="mb-1 font-medium">{t("mission.x.actionLabel")}</legend>
            {(["retweet", "reply"] as const).map((a) => (
              <label key={a} className="flex items-center gap-1">
                <input
                  type="radio"
                  name="mission-action"
                  checked={action === a}
                  onChange={() => setAction(a)}
                />
                {t(`mission.x.action.${a}`)}
              </label>
            ))}
          </fieldset>
          <label htmlFor="mission-hold" className="block font-medium">
            {t("mission.x.holdLabel")}
          </label>
          {holds.length > 0 ? (
            <select
              id="mission-hold"
              value={holdDays}
              onChange={(e) => setHoldDays(Number(e.target.value))}
              className="h-9 rounded border bg-background px-2"
            >
              {holds.map((d) => (
                <option key={d} value={d}>
                  {t("mission.x.days", { n: d })}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-destructive">{t("mission.x.tooLate")}</p>
          )}
          <p className="text-muted-foreground">{t("mission.x.holdHint")}</p>
        </div>
      )}
      <Button type="submit" size="sm" disabled={busy || !ready}>
        {t("mission.launch")}
      </Button>
    </form>
  );
}

const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

function MissionCard({
  huntId,
  mission: m,
  me,
  isCreator,
  nameOf,
  now,
  prefillCode,
  members,
  crypt,
  onPost,
}: {
  huntId: string;
  mission: Mission;
  me: string;
  isCreator: boolean;
  nameOf: (author: string) => string;
  now: number;
  prefillCode?: string;
  members: string[];
  crypt: XCrypt;
  onPost: Post;
}) {
  const { t } = useI18n();
  const mine = m.proofs.find((p) => p.author === me);
  // X : validée d'abord « provisoirement », puis confirmée ou retirée au contrôle surprise.
  const mineKey = !mine
    ? null
    : mine.held === "removed"
      ? "mission.x.mine.removed"
      : mine.held === "confirmed"
        ? "mission.x.mine.confirmed"
        : m.kind === "x" && mine.status === "valid"
          ? "mission.x.mine.provisional"
          : (`mission.mine.${mine.status}` as const);
  const valid = m.proofs.filter((p) => p.status === "valid").length;

  return (
    <div className="space-y-2 rounded border bg-background p-3 text-sm">
      <p className={m.kind === "sign" ? "whitespace-pre-wrap" : "font-medium"}>{m.text}</p>
      <p className="text-xs text-muted-foreground">
        {t(`mission.kind.${m.kind}`)} · {t("mission.validCount", { n: valid })}
      </p>
      {mine && (
        <p className="flex items-center gap-1 text-xs">
          {mine.status === "valid" && mine.held !== "removed" ? (
            <Check className="size-4 text-green-600" aria-hidden />
          ) : mine.status === "invalid" || mine.held === "removed" ? (
            <X className="size-4 text-destructive" aria-hidden />
          ) : null}
          {t(mineKey!, { n: (m.hold ?? 0) / DAY })}
        </p>
      )}
      {m.badReveal && (
        <p role="alert" className="text-xs text-destructive">
          {t("mission.badReveal")}
        </p>
      )}
      {m.kind === "code" ? (
        <CodePart
          huntId={huntId}
          mission={m}
          me={me}
          isCreator={isCreator}
          now={now}
          hasProof={!!mine}
          {...(prefillCode ? { prefillCode } : {})}
          onPost={onPost}
        />
      ) : m.kind === "x" ? (
        <XPart
          mission={m}
          me={me}
          members={members}
          nameOf={nameOf}
          now={now}
          hasProof={!!mine}
          crypt={crypt}
          onPost={onPost}
        />
      ) : m.kind === "sign" ? (
        <SignPart mission={m} isCreator={isCreator} hasProof={!!mine} onPost={onPost} />
      ) : (
        <PeerPart mission={m} me={me} nameOf={nameOf} hasProof={!!mine} onPost={onPost} />
      )}
    </div>
  );
}

function CodePart({
  huntId,
  mission: m,
  me,
  isCreator,
  now,
  hasProof,
  prefillCode,
  onPost,
}: {
  huntId: string;
  mission: Mission;
  me: string;
  isCreator: boolean;
  now: number;
  hasProof: boolean;
  prefillCode?: string;
  onPost: Post;
}) {
  const { t } = useI18n();
  const [code, setCode] = useState(prefillCode ?? "");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const w = m.window;
  const open = w && now >= w.opensAt && now <= w.closesAt;
  const mineCode = isCreator ? savedCode(m.id) : null;

  if (isCreator) {
    if (!w)
      return (
        <Button
          size="sm"
          disabled={busy}
          onClick={() => {
            const c = newCode();
            saveCode(m.id, c);
            const opensAt = Date.now();
            setBusy(true);
            void onPost("", {
              t: "open",
              id: m.id,
              hash: codeHash(m.id, c),
              opensAt,
              closesAt: opensAt + CODE_WINDOW_MS,
            }).finally(() => setBusy(false));
          }}
        >
          {t("mission.openWindow")}
        </Button>
      );
    // Révéler : à la fin de la fenêtre, ou plus tôt si le créateur clôt.
    const reveal = (label: string) => (
      <Button
        size="sm"
        variant={open ? "outline" : "default"}
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void onPost("", {
            t: "reveal",
            id: m.id,
            code: mineCode!,
            seen: m.proofs.map((p) => shortId(p.msgId)),
          }).finally(() => setBusy(false));
        }}
      >
        {label}
      </Button>
    );
    if (open && mineCode && !m.revealed) {
      const base = typeof window === "undefined" ? "" : window.location.href.split("#")[0]!;
      const link = `${base}#/hunt/${huntId}?code=${mineCode}`;
      return (
        <div className="space-y-2 text-center">
          <p className="font-mono text-3xl font-bold tracking-widest">{mineCode}</p>
          <div
            className="mx-auto w-44 rounded bg-white p-2"
            role="img"
            aria-label={t("mission.qr")}
            dangerouslySetInnerHTML={{ __html: qrSvg(link) }}
          />
          <p className="text-xs text-muted-foreground">
            {t("mission.showCode", { left: clock(w.closesAt - now) })}
          </p>
          {reveal(t("mission.closeNow", { n: m.proofs.length }))}
        </div>
      );
    }
    if (!m.revealed && now > w.closesAt && mineCode)
      return reveal(t("mission.reveal", { n: m.proofs.length }));
    return null;
  }

  if (!w) return <p className="text-xs text-muted-foreground">{t("mission.notOpen")}</p>;
  if (m.revealed) return null; // le statut au-dessus suffit
  if (!open || hasProof)
    return (
      <p className="text-xs text-muted-foreground">
        {hasProof
          ? t("mission.sent")
          : now < w.opensAt
            ? t("mission.notOpen")
            : t("mission.closed")}
      </p>
    );
  return (
    <form
      className="space-y-1"
      onSubmit={(e) => {
        e.preventDefault();
        const c = normalizeCode(code);
        // Vérifié tout de suite contre l'empreinte publiée par le créateur.
        if (codeHash(m.id, c) !== w.hash) return setError(true);
        setBusy(true);
        void onPost("", { t: "proof", id: m.id, mac: codeProof(c, m.id, me) }).finally(() =>
          setBusy(false),
        );
      }}
    >
      <label htmlFor={`code-${m.id}`} className="text-xs font-medium">
        {t("mission.enterCode", { left: clock(w.closesAt - now) })}
      </label>
      <div className="flex gap-2">
        <Input
          id={`code-${m.id}`}
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setError(false);
          }}
          autoComplete="off"
          className="h-9 font-mono uppercase tracking-widest"
          maxLength={8}
        />
        <Button type="submit" size="sm" disabled={busy || normalizeCode(code).length !== 6}>
          {t("mission.prove")}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {t("mission.wrongCode")}
        </p>
      )}
    </form>
  );
}

function PeerPart({
  mission: m,
  me,
  nameOf,
  hasProof,
  onPost,
}: {
  mission: Mission;
  me: string;
  nameOf: (author: string) => string;
  hasProof: boolean;
  onPost: Post;
}) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const toCheck = m.proofs.filter((p) => p.checkers.includes(me) && !(me in p.votes));

  return (
    <div className="space-y-3">
      {!hasProof && (
        <form
          className="space-y-1"
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            setBusy(true);
            void onPost("", { t: "proof", id: m.id, text: text.trim() })
              .then((ok) => ok && setText(""))
              .finally(() => setBusy(false));
          }}
        >
          <label htmlFor={`proof-${m.id}`} className="text-xs font-medium">
            {t("mission.proofLabel")}
          </label>
          <Textarea
            id={`proof-${m.id}`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={500}
            rows={2}
          />
          <p className="text-xs text-muted-foreground">{t("mission.proofHint")}</p>
          <Button type="submit" size="sm" disabled={busy || !text.trim()}>
            {t("mission.sendProof")}
          </Button>
        </form>
      )}
      {toCheck.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium">{t("mission.toCheck", { n: toCheck.length })}</p>
          {toCheck.map((p) => (
            <div key={p.msgId} className="space-y-1 rounded border p-2">
              <p className="text-xs text-muted-foreground">{nameOf(p.author)}</p>
              <p className="whitespace-pre-wrap text-sm">{p.text}</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void onPost("", { t: "vote", id: m.id, proof: p.msgId, ok: true })}
                >
                  <Check aria-hidden /> {t("mission.voteYes")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void onPost("", { t: "vote", id: m.id, proof: p.msgId, ok: false })
                  }
                >
                  <X aria-hidden /> {t("mission.voteNo")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SignPart({
  mission: m,
  isCreator,
  hasProof,
  onPost,
}: {
  mission: Mission;
  isCreator: boolean;
  hasProof: boolean;
  onPost: Post;
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const signers = m.proofs.filter((p) => p.status === "valid");
  const letter = () =>
    signedLetter(m, t("mission.anonymous"), t("mission.signersHeader", { n: signers.length }));

  return (
    <div className="space-y-3">
      {signers.length > 0 && (
        <div className="text-xs">
          <p className="font-medium">{t("mission.signersHeader", { n: signers.length })}</p>
          <ul className="mt-1 list-inside list-disc text-muted-foreground">
            {signers.map((p) => (
              <li key={p.msgId}>{p.text ?? t("mission.anonymous")}</li>
            ))}
          </ul>
        </div>
      )}
      {!hasProof && (
        <form
          className="space-y-1"
          onSubmit={(e) => {
            e.preventDefault();
            setBusy(true);
            void onPost("", {
              t: "proof",
              id: m.id,
              signed: true,
              ...(name.trim() ? { text: name.trim() } : {}),
            }).finally(() => setBusy(false));
          }}
        >
          <label htmlFor={`sign-${m.id}`} className="text-xs font-medium">
            {t("mission.signAs")}
          </label>
          <div className="flex gap-2">
            <Input
              id={`sign-${m.id}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              placeholder={t("mission.anonymous")}
              className="h-9"
            />
            <Button type="submit" size="sm" disabled={busy}>
              <PenLine aria-hidden /> {t("mission.sign")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t("mission.signHint")}</p>
        </form>
      )}
      {isCreator && signers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void navigator.clipboard?.writeText(letter()).then(() => setCopied(true));
            }}
          >
            <Copy aria-hidden /> {copied ? t("mission.copied") : t("mission.copyLetter")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const url = URL.createObjectURL(new Blob([letter()], { type: "text/plain" }));
              const a = document.createElement("a");
              a.href = url;
              a.download = "lettre.txt";
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download aria-hidden /> {t("mission.downloadLetter")}
          </Button>
        </div>
      )}
    </div>
  );
}
