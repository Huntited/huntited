import { afterEach, describe, expect, it, vi } from "vitest";

import { huntPreviewMeta } from "./hunt-preview";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const preview = { title: "Rassemblement", threshold: 12, deadline: "2026-10-20T16:00:00.000Z" };
const content = (meta: ReturnType<typeof huntPreviewMeta>, key: string) =>
  meta.find((m) => ("property" in m && m.property === key) || ("name" in m && m.name === key)) as
    { content: string } | undefined;

describe("aperçu riche d'une chasse", () => {
  it("annonce le titre, le seuil et la date limite, sans lieu ni compteur", () => {
    const meta = huntPreviewMeta(preview, "h1");
    expect(meta).toContainEqual({ title: "Rassemblement — Huntited" });
    expect(content(meta, "og:title")?.content).toBe("Rassemblement — Huntited");
    const description = content(meta, "og:description")!.content;
    expect(description).toContain("au moins 12 personnes avant le 20 octobre 2026");
    expect(JSON.stringify(meta)).not.toMatch(/commitCount|kaspa|lieu/i);
  });

  it("ajoute l'image grand format seulement si l'adresse du site est connue", () => {
    expect(content(huntPreviewMeta(preview, "h1"), "twitter:card")?.content).toBe("summary");
    expect(content(huntPreviewMeta(preview, "h1"), "og:image")).toBeUndefined();

    vi.stubEnv("VITE_SITE_URL", "https://huntited.test/");
    const meta = huntPreviewMeta(preview, "h1");
    expect(content(meta, "twitter:card")?.content).toBe("summary_large_image");
    expect(content(meta, "og:image")?.content).toBe("https://huntited.test/og-image.png");
    expect(content(meta, "og:url")?.content).toBe("https://huntited.test/hunt/h1");
  });

  it("reste générique pour une chasse inconnue", () => {
    expect(huntPreviewMeta(null, "h1")).toContainEqual({ title: "Chasse — Huntited" });
  });
});
