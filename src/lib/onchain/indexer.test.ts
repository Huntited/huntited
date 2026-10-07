import { describe, expect, it } from "vitest";

import { restSource } from "./indexer";

describe("lecture de la blockchain par plusieurs points d'accès", () => {
  it("bascule sur un autre point d'accès si l'un ne répond pas", async () => {
    const asked: string[] = [];
    const fake = (async (url: string) => {
      asked.push(new URL(url).host);
      if (url.startsWith("https://panne.test")) throw new Error("réseau");
      return new Response(JSON.stringify({ blueScore: 42 }), { status: 200 });
    }) as typeof fetch;
    const source = restSource(["https://panne.test", "https://ok.test"], fake);
    for (let i = 0; i < 5; i++) expect(await source.virtualBlueScore()).toBe(42);
    expect(asked).toContain("ok.test");
  });

  it("signale l'échec si aucun ne répond", async () => {
    const fake = (async () => new Response("", { status: 503 })) as unknown as typeof fetch;
    await expect(
      restSource(["https://a.test", "https://b.test"], fake).virtualBlueScore(),
    ).rejects.toThrow("chain_api_503");
  });
});
