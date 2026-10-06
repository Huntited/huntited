// Actions de parcours réutilisables (une « personne » = un contexte de
// navigateur isolé : son propre stockage, donc son propre wallet factice).
import { randomBytes } from "node:crypto";

import { expect, type APIRequestContext, type Browser, type Page } from "@playwright/test";

export const API = "http://localhost:3099";

/**
 * Participant « de remplissage » engagé directement par l'API (wallet
 * factice : même format d'adresse et de signature que le wallet mock du
 * front). Sert à atteindre le seuil minimum de 7 sans ouvrir 7 navigateurs.
 */
export async function apiCommit(
  request: APIRequestContext,
  huntId: string,
  personalThreshold?: number,
) {
  const walletAddress = `kaspa:mock${randomBytes(20).toString("hex")}`;
  const challenge = await (
    await request.post(`${API}/api/auth/challenge`, { data: { walletAddress } })
  ).json();
  const session = await (
    await request.post(`${API}/api/auth/session`, {
      data: {
        walletAddress,
        challengeId: challenge.challengeId,
        signature: `mocksig_${randomBytes(32).toString("hex")}`,
      },
    })
  ).json();
  const res = await request.post(`${API}/api/hunts/${huntId}/commit`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    data: personalThreshold === undefined ? {} : { personalThreshold },
  });
  expect(res.status()).toBe(201);
}

export async function newPerson(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  return context.newPage();
}

/**
 * Ouvre une page et attend qu'elle soit interactive : la page est d'abord
 * rendue par le serveur, et React n'y branche les clics qu'après le
 * chargement de ses modules (sinon clics et saisies sont perdus).
 */
export async function open(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}

export async function reload(page: Page) {
  await page.reload();
  await page.waitForLoadState("networkidle");
}

/** Le wallet factice est-il réellement connecté (état enregistré par l'app) ? */
async function walletConnected(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    try {
      const raw = window.localStorage.getItem("huntited:wallet");
      return raw ? (JSON.parse(raw) as { isConnected?: boolean }).isConnected === true : false;
    } catch {
      return false;
    }
  });
}

export async function connectWallet(page: Page) {
  // Réessaie le clic s'il a été perdu (page pas encore interactive), jusqu'à
  // ce que l'application ait réellement enregistré la connexion.
  await expect(async () => {
    if (!(await walletConnected(page))) {
      await page.getByRole("button", { name: "Connecter le wallet" }).first().click();
    }
    expect(await walletConnected(page)).toBe(true);
  }).toPass({ timeout: 15_000, intervals: [700, 1000, 2000] });
  await expect(page.getByRole("button", { name: "Connecter le wallet" })).toHaveCount(0);
}

/** Date limite au format du champ datetime-local (heure locale). */
export function localDeadline(msFromNow: number): string {
  const d = new Date(Date.now() + msFromNow);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Remplit le formulaire de création (sans l'envoyer). */
export async function fillCreateFields(
  page: Page,
  opts: { title: string; threshold: number; hideProgress?: boolean },
) {
  await open(page, "/create");
  await page.getByPlaceholder("Ex. Rassemblement place de la République").fill(opts.title);
  await page
    .getByPlaceholder("Décrivez l'action collective en quelques lignes.")
    .fill("Parcours de test automatique.");
  await page.getByPlaceholder("Ex. Paris, place de la République").fill("Lieu de test");
  await page.getByLabel("Date et heure limite").fill(localDeadline(2 * 86_400_000));
  await page.getByPlaceholder("Ex. 50").fill(String(opts.threshold));
  if (opts.hideProgress)
    await page.getByRole("checkbox", { name: "Masquer la progression" }).click();
}

/** Remplit le formulaire de création et arrive sur le récapitulatif. */
export async function fillCreateForm(
  page: Page,
  opts: { title: string; threshold: number; hideProgress?: boolean },
) {
  await fillCreateFields(page, opts);
  await page.getByRole("button", { name: "Vérifier ma chasse" }).click();
  await expect(page).toHaveURL(/\/create-review$/);
  await page.waitForLoadState("networkidle");
}

/** Crée une chasse (wallet déjà connecté) ; renvoie son URL. */
export async function createHunt(
  page: Page,
  opts: { title: string; threshold: number; hideProgress?: boolean },
): Promise<string> {
  await fillCreateForm(page, opts);
  await page.getByRole("button", { name: "Confirmer et créer la chasse" }).click();
  await expect(page).toHaveURL(/\/hunt\/[0-9a-f]+$/);
  await expect(page.getByRole("heading", { name: opts.title })).toBeVisible();
  return page.url();
}

/** S'engage sur la page de chasse ouverte, avec un seuil personnel facultatif. */
export async function commit(page: Page, personalThreshold?: number) {
  await page.getByRole("button", { name: /S'engager/ }).click();
  const dialog = page.getByRole("dialog");
  if (personalThreshold !== undefined) {
    await dialog.locator("#personal-threshold").fill(String(personalThreshold));
  }
  await dialog.getByRole("checkbox").click();
  await dialog.getByRole("button", { name: "Confirmer l'engagement" }).click();
  await expect(page.getByRole("button", { name: "Déjà engagé·e" })).toBeVisible();
}
