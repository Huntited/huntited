// Accessibilité automatique (axe, règles WCAG 2 A et AA) des pages
// principales, en thème clair et sombre, sur ordinateur et sur mobile.
// Échoue sur les problèmes « graves » ou « critiques ».
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { connectWallet, createHunt, open } from "./helpers";

async function audit(page: Page, label: string) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const blocking = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  const summary = blocking.map(
    (v) =>
      `${label} — ${v.id} (${v.impact}) : ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
  );
  expect(summary).toEqual([]);
}

async function setTheme(page: Page, theme: "light" | "dark") {
  await page.evaluate((t) => {
    localStorage.setItem("huntited:theme", t);
    document.documentElement.classList.toggle("dark", t === "dark");
  }, theme);
}

for (const theme of ["light", "dark"] as const) {
  test(`accessibilité des pages principales (${theme})`, async ({ page }) => {
    for (const path of ["/", "/create", "/pass", "/my-hunts", "/legal", "/nulle-part"]) {
      await open(page, path);
      await setTheme(page, theme);
      await audit(page, `${path} ${theme}`);
    }
  });
}

test("accessibilité d'une chasse et de la fenêtre d'engagement", async ({ page }) => {
  await open(page, "/");
  await connectWallet(page);
  await createHunt(page, { title: "Chasse accessible", threshold: 7 });
  await audit(page, "chasse");
  await page.getByRole("button", { name: /S'engager/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  // Fin de l'animation d'ouverture (le contraste est faussé pendant le fondu).
  await page.waitForTimeout(400);
  await audit(page, "fenêtre d'engagement");
});

test("menu mobile : ouverture, navigation, accessibilité", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await open(page, "/");
  const toggle = page.getByRole("button", { name: "Ouvrir le menu" });
  await toggle.click();
  await expect(page.getByRole("button", { name: "Fermer le menu" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await audit(page, "menu mobile");
  await page.locator("#mobile-menu").getByRole("link", { name: "Mon pass" }).click();
  await expect(page).toHaveURL(/\/pass$/);
  // Le menu se referme après la navigation.
  await expect(page.locator("#mobile-menu")).toHaveCount(0);
});

test("lien d'évitement et thème sombre mémorisé", async ({ page }) => {
  await open(page, "/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Aller au contenu" })).toBeFocused();
  await page.getByRole("button", { name: "Passer en thème sombre" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
});
