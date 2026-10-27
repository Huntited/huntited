// Mission « Action sur X » (src/lib/missions.ts, docs/missions.md) : le membre
// envoie le lien de son retweet (profil) ou de son commentaire, chiffré pour
// ses trois vérificateurs seulement ; ils votent, puis refont un contrôle à un
// moment secret, tiré sur leur appareil, pendant le délai de maintien.
import { Check, ExternalLink, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import {
  HOLD_GRACE_MS,
  holdCheckAt,
  xCheckersOf,
  xProofUrl,
  type Mission,
  type MissionMsg,
  type MissionProof,
} from "@/lib/missions";

/** Chiffrement entre deux membres du salon (fourni par le salon). */
export interface XCrypt {
  seal: (to: string, url: string) => Promise<string>;
  open: (from: string, sealed: string) => Promise<string>;
}

type Post = (text: string, mission: MissionMsg) => Promise<boolean>;

const CHECKS = "huntited:x-checks";
const slot = (pub: string) => pub.slice(0, 16);

/** Moment secret du contrôle de maintien : tiré une fois, gardé sur cet appareil. */
function secretCheckAt(p: MissionProof, hold: number): number {
  try {
    const all = JSON.parse(localStorage.getItem(CHECKS) ?? "{}") as Record<string, number>;
    if (typeof all[p.msgId] === "number") return all[p.msgId]!;
    const r = crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32;
    const at = holdCheckAt(p.at, hold, r);
    localStorage.setItem(CHECKS, JSON.stringify({ ...all, [p.msgId]: at }));
    return at;
  } catch {
    // Sans stockage : un moment pris dans cette visite seulement.
    return holdCheckAt(p.at, hold, Math.random());
  }
}

/** Lien d'une preuve, déchiffré pour ce vérificateur (null : illisible). */
function useLink(p: MissionProof, me: string, crypt: XCrypt): string | null | undefined {
  const [link, setLink] = useState<string | null | undefined>(undefined);
  const sealed = p.links?.[slot(me)];
  useEffect(() => {
    if (!sealed) return setLink(null);
    let live = true;
    crypt
      .open(p.author, sealed)
      .then((u) => live && setLink(u))
      .catch(() => live && setLink(null));
    return () => {
      live = false;
    };
  }, [sealed, p.author, crypt]);
  return link;
}

export function XPart({
  mission: m,
  me,
  members,
  nameOf,
  now,
  hasProof,
  crypt,
  onPost,
}: {
  mission: Mission;
  me: string;
  members: string[];
  nameOf: (author: string) => string;
  now: number;
  hasProof: boolean;
  crypt: XCrypt;
  onPost: Post;
}) {
  const { t } = useI18n();
  const [url, setUrl] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const action = m.action ?? "reply";
  const hold = m.hold ?? 0;
  const checkers = xCheckersOf(m.id, me, members);
  const mine = m.proofs.filter((p) => p.checkers.includes(me));
  const first = mine.filter((p) => !(me in p.votes));
  const surprise = mine.filter(
    (p) =>
      p.status === "valid" &&
      !(me in p.holdVotes) &&
      now >= secretCheckAt(p, hold) &&
      now <= p.at + hold + HOLD_GRACE_MS,
  );

  return (
    <div className="space-y-3">
      {m.target && (
        <a
          href={m.target}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs underline"
        >
          <ExternalLink className="size-3" aria-hidden /> {t("mission.x.openTarget")}
        </a>
      )}
      <p className="text-xs text-muted-foreground">
        {t(`mission.x.action.${action}`)} · {t("mission.x.holdFor", { n: hold / 86_400_000 })}
      </p>
      {!hasProof && checkers.length > 0 && (
        <form
          className="space-y-1"
          onSubmit={(e) => {
            e.preventDefault();
            const clean = xProofUrl(action, url);
            if (!clean) return setError(true);
            setBusy(true);
            void Promise.all(checkers.map(async (c) => [slot(c), await crypt.seal(c, clean)]))
              .then((pairs) =>
                onPost("", { t: "proof", id: m.id, links: Object.fromEntries(pairs) }),
              )
              .finally(() => setBusy(false));
          }}
        >
          <label htmlFor={`x-${m.id}`} className="text-xs font-medium">
            {t(`mission.x.linkLabel.${action}`)}
          </label>
          <div className="flex gap-2">
            <Input
              id={`x-${m.id}`}
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setError(false);
              }}
              inputMode="url"
              autoComplete="off"
              placeholder={action === "retweet" ? "https://x.com/…" : "https://x.com/…/status/…"}
              className="h-9"
            />
            <Button type="submit" size="sm" disabled={busy || !url.trim()}>
              {t("mission.sendProof")}
            </Button>
          </div>
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {t(`mission.x.badLink.${action}`)}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {t("mission.x.onlyCheckers", { names: checkers.map(nameOf).join(", ") })}
          </p>
        </form>
      )}
      {first.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium">{t("mission.toCheck", { n: first.length })}</p>
          {first.map((p) => (
            <CheckItem
              key={p.msgId}
              proof={p}
              me={me}
              crypt={crypt}
              nameOf={nameOf}
              question={t(`mission.x.check.${action}`)}
              yes={t("mission.voteYes")}
              no={t("mission.voteNo")}
              onVote={(ok) => void onPost("", { t: "vote", id: m.id, proof: p.msgId, ok })}
            />
          ))}
        </div>
      )}
      {surprise.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium">{t("mission.x.surprise", { n: surprise.length })}</p>
          {surprise.map((p) => (
            <CheckItem
              key={p.msgId}
              proof={p}
              me={me}
              crypt={crypt}
              nameOf={nameOf}
              question={t("mission.x.stillThere")}
              yes={t("mission.x.kept")}
              no={t("mission.x.removed")}
              onVote={(ok) =>
                void onPost("", { t: "vote", id: m.id, proof: p.msgId, ok, hold: true })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CheckItem({
  proof: p,
  me,
  crypt,
  nameOf,
  question,
  yes,
  no,
  onVote,
}: {
  proof: MissionProof;
  me: string;
  crypt: XCrypt;
  nameOf: (author: string) => string;
  question: string;
  yes: string;
  no: string;
  onVote: (ok: boolean) => void;
}) {
  const { t } = useI18n();
  const link = useLink(p, me, crypt);
  return (
    <div className="space-y-1 rounded border p-2">
      <p className="text-xs text-muted-foreground">{nameOf(p.author)}</p>
      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 break-all text-sm underline"
        >
          <ExternalLink className="size-3 shrink-0" aria-hidden /> {link}
        </a>
      ) : (
        <p className="text-xs text-muted-foreground">
          {link === null ? t("mission.x.unreadable") : "…"}
        </p>
      )}
      <p className="text-xs">{question}</p>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={!link} onClick={() => onVote(true)}>
          <Check aria-hidden /> {yes}
        </Button>
        <Button size="sm" variant="outline" disabled={!link} onClick={() => onVote(false)}>
          <X aria-hidden /> {no}
        </Button>
      </div>
    </div>
  );
}
