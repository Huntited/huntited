/** Lien public d'une chasse : uniquement son identifiant, aucune donnée personnelle. */
export function huntShareUrl(huntId: string, origin: string): string {
  return `${origin}/hunt/${encodeURIComponent(huntId)}`;
}
