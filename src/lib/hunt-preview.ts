// Balises d'aperçu d'un lien de chasse (X, WhatsApp, Signal…). Le site est
// statique : sans serveur pour lire la chasse, l'aperçu reste générique.
// Seules des informations publiques seraient utilisées : titre, seuil, date.

export interface HuntPreview {
  title: string;
  threshold: number;
  deadline: string;
}

/** Adresse publique du site (ex. https://huntited.app), pour l'image d'aperçu. */
export function siteUrl(): string | null {
  const v = import.meta.env["VITE_SITE_URL"] as string | undefined;
  return v ? v.replace(/\/+$/, "") : null;
}

export function huntPreviewDescription(p: HuntPreview): string {
  const date = new Date(p.deadline).toLocaleDateString("fr-FR", {
    dateStyle: "long",
    timeZone: "Europe/Paris",
  });
  return `Action collective : il faut au moins ${p.threshold} personnes avant le ${date}. Tout le monde ou personne : sinon, chacun est remboursé.`;
}

type Meta =
  { title: string } | { name: string; content: string } | { property: string; content: string };

/** Balises <head> d'une page de chasse (génériques si la chasse est inconnue). */
export function huntPreviewMeta(p: HuntPreview | null, id: string): Meta[] {
  const title = p ? `${p.title} — Huntited` : "Chasse — Huntited";
  const description = p
    ? huntPreviewDescription(p)
    : "Une action collective sur Huntited : tout le monde ou personne. Sinon, chacun est remboursé.";
  const site = siteUrl();
  return [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: "Huntited" },
    ...(site
      ? [
          { property: "og:url", content: `${site}/hunt/${encodeURIComponent(id)}` },
          { property: "og:image", content: `${site}/og-image.png` },
          { property: "og:image:width", content: "1200" },
          { property: "og:image:height", content: "630" },
          { name: "twitter:card", content: "summary_large_image" },
        ]
      : [{ name: "twitter:card", content: "summary" }]),
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
  ];
}
