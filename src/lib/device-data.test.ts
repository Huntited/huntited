import { beforeEach, describe, expect, it } from "vitest";

import { eraseDeviceData, exportDeviceData, readDeviceData } from "./device-data";

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("huntited:pass", '{"secret":"s3cr3t"}');
  localStorage.setItem("huntited:theme", "dark");
  localStorage.setItem("huntited:locale", "fr");
  localStorage.setItem("huntited:push", '["h1","h2"]');
  localStorage.setItem("huntited:something-new", "x");
  localStorage.setItem("autre-site", "à ne pas toucher");
});

describe("données de l'appareil", () => {
  it("regroupe les clés Huntited, dans l'ordre, sans les autres", () => {
    const groups = readDeviceData();
    expect(groups.map((g) => g.id)).toEqual(["pass", "notify", "prefs", "other"]);
    expect(groups.find((g) => g.id === "prefs")!.entries.map((e) => e.key)).toEqual([
      "huntited:locale",
      "huntited:theme",
    ]);
    expect(JSON.stringify(groups)).not.toContain("autre-site");
  });

  it("exporte tout (pass compris) en JSON lisible", () => {
    const out = JSON.parse(exportDeviceData(new Date("2026-10-07T10:00:00Z"))) as {
      exportedAt: string;
      data: Record<string, unknown>;
    };
    expect(out.exportedAt).toBe("2026-10-07T10:00:00.000Z");
    expect(out.data["huntited:pass"]).toEqual({ secret: "s3cr3t" });
    expect(out.data["huntited:theme"]).toBe("dark");
    expect(out.data["autre-site"]).toBeUndefined();
  });

  it("efface tout ce qui est à Huntited, et laisse le reste", async () => {
    await eraseDeviceData();
    expect(readDeviceData()).toEqual([]);
    expect(localStorage.getItem("autre-site")).toBe("à ne pas toucher");
  });
});
