import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { recordShare } from "@/lib/badge-store";
import { huntReplyText, huntShareUrl, parseTweetId, xReplyIntentUrl } from "@/lib/share";
import type { Hunt } from "@/lib/types";
import { getWalletState } from "@/lib/wallet";

/**
 * « Répondre à un tweet » : on colle l'adresse d'un tweet, X s'ouvre sur une
 * réponse préremplie (appel à l'action + lien de la chasse). L'utilisateur
 * publie lui-même : Huntited n'utilise pas l'API X et ne connaît pas son compte.
 * L'adresse du tweet ne quitte pas le navigateur (hors ouverture de X).
 */
export function ReplyOnXButton({ hunt }: { hunt: Pick<Hunt, "id" | "title" | "threshold"> }) {
  const [open, setOpen] = useState(false);
  const [tweetUrl, setTweetUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleOpen(event: React.FormEvent) {
    event.preventDefault();
    const tweetId = parseTweetId(tweetUrl);
    if (!tweetId) {
      setError("Colle l'adresse d'un tweet, par exemple https://x.com/nom/status/123…");
      return;
    }
    const url = huntShareUrl(hunt.id, window.location.origin);
    window.open(
      xReplyIntentUrl(tweetId, huntReplyText(hunt), url),
      "_blank",
      "noopener,noreferrer",
    );
    // Badge Messager·ère, comme pour le bouton Partager.
    const { address } = getWalletState();
    if (address) recordShare(address, hunt.id);
    setOpen(false);
    setTweetUrl("");
    setError(null);
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} aria-expanded={false}>
        Répondre à un tweet
      </Button>
    );
  }

  return (
    <form
      onSubmit={handleOpen}
      className="w-full space-y-2 rounded-lg border bg-card p-3 text-sm sm:w-80"
    >
      <label htmlFor="tweet-url" className="font-medium">
        Adresse du tweet
      </label>
      <Input
        id="tweet-url"
        value={tweetUrl}
        onChange={(e) => {
          setTweetUrl(e.target.value);
          setError(null);
        }}
        placeholder="https://x.com/…/status/…"
        aria-invalid={error !== null}
        autoComplete="off"
        autoFocus
      />
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        X s'ouvre avec une réponse déjà rédigée et le lien de la chasse. Tu peux la modifier avant
        de publier, depuis ton compte.
      </p>
      <div className="flex gap-2">
        <Button type="submit" size="sm" className="flex-1">
          Ouvrir la réponse sur X
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
        >
          Annuler
        </Button>
      </div>
    </form>
  );
}
