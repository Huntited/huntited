// Version du site et vérification de son ancrage sur Kaspa.
//
// La version statique contient release.json (liste de ses fichiers et
// empreinte de cette liste). L'adresse de publication ancre cette empreinte
// sur la chaîne (page #/publish). Le site compare : version officielle ou non.
//
// Limite : un faux site peut mentir dans son propre affichage. La preuve
// réelle se fait de l'extérieur : scripts/verify-release.mjs recalcule les
// empreintes des fichiers servis et les compare à la chaîne.
import { getChainReleases } from "./onchain/browser-index";

export interface ReleaseInfo {
  version: string;
  manifest: string;
}

export const appVersion = () =>
  (import.meta.env["VITE_APP_VERSION"] as string | undefined) ?? "dev";

/** Contenu de release.json (version statique seulement), ou null. */
export async function loadReleaseInfo(): Promise<ReleaseInfo | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}release.json`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<ReleaseInfo>;
    return typeof data.version === "string" && /^[0-9a-f]{64}$/.test(data.manifest ?? "")
      ? { version: data.version, manifest: data.manifest! }
      : null;
  } catch {
    return null;
  }
}

export type ReleaseStatus = "verified" | "mismatch" | "unanchored";

/** Cette version est-elle ancrée sur Kaspa, avec la même empreinte ? */
export async function checkRelease(info: ReleaseInfo): Promise<ReleaseStatus> {
  const anchored = (await getChainReleases()).find((r) => r.version === info.version);
  if (!anchored) return "unanchored";
  return anchored.manifest === info.manifest ? "verified" : "mismatch";
}
