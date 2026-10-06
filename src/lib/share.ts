/** Lien public d'une chasse : uniquement son identifiant, aucune donnée personnelle. */
export function huntShareUrl(huntId: string, origin: string): string {
  return `${origin}/hunt/${encodeURIComponent(huntId)}`;
}

/**
 * Identifiant d'un tweet à partir de son adresse (x.com ou twitter.com,
 * avec ou sans « www. » / « mobile. »), ou null si ce n'en est pas une.
 */
export function parseTweetId(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.replace(/^(www|mobile)\./, "");
  if (host !== "x.com" && host !== "twitter.com") return null;
  const m = /^\/[A-Za-z0-9_]{1,15}\/status(?:es)?\/(\d{1,20})(?:\/|$)/.exec(url.pathname);
  return m ? m[1]! : null;
}

/** Message proposé sous un tweet (l'utilisateur peut le modifier avant de publier). */
export function huntReplyText(
  hunt: { title: string; threshold: number },
  locale: "fr" | "en" = "fr",
): string {
  return locale === "fr"
    ? `Je n'y vais pas seul·e : rejoins « ${hunt.title} » sur Huntited. L'action n'a lieu que si on est au moins ${hunt.threshold}.`
    : `I'm not going alone: join "${hunt.title}" on Huntited. The action only happens if at least ${hunt.threshold} of us commit.`;
}

/**
 * Lien X qui ouvre une réponse préremplie au tweet donné. C'est l'utilisateur
 * qui publie, depuis son compte : aucune API X, aucun compte relié à Huntited.
 */
export function xReplyIntentUrl(tweetId: string, text: string, url: string): string {
  const params = new URLSearchParams({ in_reply_to: tweetId, text, url });
  return `https://x.com/intent/tweet?${params.toString()}`;
}
