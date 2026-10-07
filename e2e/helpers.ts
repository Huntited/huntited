// Actions de parcours réutilisables (une « personne » = un contexte de
// navigateur isolé : son propre stockage, donc son propre wallet factice).
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

import { expect, type APIRequestContext, type Browser, type Page } from "@playwright/test";
import { Group, Identity } from "@semaphore-protocol/core";

import { generateProofSingleThread } from "../src/lib/zk-prove";

export const API = "http://localhost:3099";

const ZK = {
  wasm: fileURLToPath(new URL("../public/zk/semaphore-20.wasm", import.meta.url)),
  zkey: fileURLToPath(new URL("../public/zk/semaphore-20.zkey", import.meta.url)),
};

/**
 * Participant « de remplissage » engagé directement par l'API : pass créé
 * avec une invitation de départ, preuve calculée ici (Node), wallet factice
 * (même format d'adresse et de signature que le wallet mock du front).
 * Sert à atteindre le seuil minimum de 7 sans ouvrir 7 navigateurs.
 */
export async function apiCommit(
  request: APIRequestContext,
  huntId: string,
  invitation: string,
  personalThreshold?: number,
) {
  const pass = new Identity();
  const redeem = await request.post(`${API}/api/passes/redeem`, {
    data: { invitation, commitment: pass.commitment.toString() },
  });
  expect(redeem.status()).toBe(201);
  const { members } = await (await request.get(`${API}/api/passes/group`)).json();
  const proof = await generateProofSingleThread(
    pass,
    new Group((members as string[]).map(BigInt)),
    personalThreshold ?? 0,
    `hunt:${huntId}`,
    20,
    ZK,
  );
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
    data: { ...(personalThreshold === undefined ? {} : { personalThreshold }), proof },
  });
  expect(res.status()).toBe(201);
}

/** Crée le pass de cette personne avec une invitation (code ou lien). */
export async function getPass(page: Page, invitation: string) {
  const url = invitation.startsWith("http") ? invitation : `/pass#${invitation}`;
  await open(page, url);
  await page.getByRole("button", { name: "Créer mon pass" }).click();
  await expect(page.getByText("Ton pass est actif sur cet appareil.")).toBeVisible({
    timeout: 20_000,
  });
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

export interface CreateOpts {
  title: string;
  threshold: number;
  hideProgress?: boolean;
  country?: string;
  /** Action en ligne (ni ville ni pays). */
  online?: boolean;
}

/** Remplit le formulaire de création (sans l'envoyer). */
export async function fillCreateFields(page: Page, opts: CreateOpts) {
  await open(page, "/create");
  await page.getByPlaceholder("Ex. Rassemblement place de la République").fill(opts.title);
  await page
    .getByPlaceholder("Décrivez l'action collective en quelques lignes.")
    .fill("Parcours de test automatique.");
  if (opts.online) {
    await page.getByRole("radio", { name: "En ligne" }).click();
  } else {
    // Ville vérifiée dans la base : une vraie ville du pays choisi.
    const city = { FR: "Marseille", BE: "Liège" }[opts.country ?? "FR"] ?? "Marseille";
    await page.getByPlaceholder("Ex. Marseille").fill(city);
  }
  await page.getByLabel("Date et heure limite").fill(localDeadline(2 * 86_400_000));
  await page.getByPlaceholder("Ex. 50").fill(String(opts.threshold));
  if (opts.hideProgress)
    await page.getByRole("checkbox", { name: "Masquer la progression" }).click();
  // Pays : jamais deviné, à choisir (France par défaut dans les tests).
  if (!opts.online) await page.getByLabel("Pays").selectOption(opts.country ?? "FR");
}

/** Remplit le formulaire de création et arrive sur le récapitulatif. */
export async function fillCreateForm(page: Page, opts: CreateOpts) {
  await fillCreateFields(page, opts);
  await page.getByRole("button", { name: "Vérifier ma chasse" }).click();
  await expect(page).toHaveURL(/\/create-review$/);
  await page.waitForLoadState("networkidle");
}

/** Crée une chasse (wallet déjà connecté) ; renvoie son URL. */
export async function createHunt(page: Page, opts: CreateOpts): Promise<string> {
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
  // La preuve de pass est calculée dans le navigateur : quelques secondes.
  await expect(page.getByRole("button", { name: "Déjà engagé·e" })).toBeVisible({
    timeout: 30_000,
  });
}
