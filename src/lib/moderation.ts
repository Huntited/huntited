// Modération (docs/moderation.md) : outils partagés.

/** Identifiant de chasse tiré d'un lien (…/hunt/<id>) ou saisi tel quel. */
export function huntIdFrom(text: string): string | null {
  const m = /(?:^|\/hunt\/)([0-9a-f]{24})(?:$|[/?#])/.exec(text.trim());
  return m ? m[1]! : null;
}
