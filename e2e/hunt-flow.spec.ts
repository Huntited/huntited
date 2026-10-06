// Parcours complet à plusieurs personnes, contre le vrai backend (registre
// partagé, sessions signées par le wallet factice, chat simulé).
import { expect, test } from "@playwright/test";

import { GENESIS } from "./genesis";
import {
  API,
  apiCommit,
  commit,
  connectWallet,
  createHunt,
  fillCreateFields,
  fillCreateForm,
  getPass,
  newPerson,
  open,
  reload,
} from "./helpers";

test("création impossible sans wallet", async ({ page }) => {
  await fillCreateForm(page, { title: "Sans wallet", threshold: 7 });
  // Bouton de la page (l'en-tête en a un aussi).
  const main = page.getByRole("main");
  await expect(main.getByRole("button", { name: "Connecter le wallet" })).toBeVisible();
  await expect(main.getByRole("button", { name: "Confirmer et créer la chasse" })).toHaveCount(0);
});

test("français / anglais, choix mémorisé, page introuvable", async ({ page }) => {
  await open(page, "/");
  await expect(
    page.getByRole("heading", { name: "Agir ensemble, sans y aller seul" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByRole("heading", { name: "Act together, never alone" })).toBeVisible();
  await reload(page);
  await expect(page.getByRole("heading", { name: "Act together, never alone" })).toBeVisible();
  await open(page, "/nulle-part");
  await expect(page.getByRole("heading", { name: "This page doesn't exist" })).toBeVisible();
  await page.getByRole("button", { name: "Français" }).click();
  await expect(page.getByRole("heading", { name: "Cette page n'existe pas" })).toBeVisible();
});

test("pays : choix à la création, affichage et filtre sur l'accueil", async ({ browser }) => {
  const alice = await newPerson(browser);
  await open(alice, "/");
  await connectWallet(alice);
  await createHunt(alice, { title: "Chasse belge", threshold: 7, country: "BE" });
  await expect(alice.getByText("Belgique")).toBeVisible();

  await open(alice, "/");
  await alice.getByRole("combobox", { name: "Filtrer par pays" }).click();
  await alice.getByRole("option", { name: "Belgique" }).click();
  await expect(alice.getByRole("link", { name: /Chasse belge/ })).toBeVisible();
  // Les chasses d'autres pays ne sont plus listées.
  await expect(alice.getByText(/, France/)).toHaveCount(0);
});

test("choisir une ville remplit le pays (recherche sur l'appareil)", async ({ page }) => {
  await open(page, "/create");
  const place = page.getByRole("combobox", { name: "Lieu" });
  await place.click();
  await place.fill("Bruxe");
  const option = page.getByRole("option", { name: /Brussels, Belgique/ });
  await expect(option).toBeVisible();
  // Clavier : flèche bas puis Entrée choisit la première suggestion.
  await place.press("ArrowDown");
  await place.press("Enter");
  await expect(place).toHaveValue("Brussels");
  await expect(page.getByLabel("Pays")).toHaveValue("BE");
  // Le lieu reste modifiable librement.
  await place.fill("Brussels, Mont des Arts");
  await expect(page.getByLabel("Pays")).toHaveValue("BE");
});

test("seuil minimum de 7 personnes à la création", async ({ page }) => {
  await fillCreateFields(page, { title: "Trop petite", threshold: 6 });
  await page.getByRole("button", { name: "Vérifier ma chasse" }).click();
  await expect(page.getByText("Le seuil doit être d'au moins 7 personnes.")).toBeVisible();
  await expect(page).toHaveURL(/\/create$/);
});

test("parcours : progression masquée, seuils personnels, activation, chat", async ({
  browser,
  request,
}) => {
  // Pass et preuves ZK réels pour chaque personne : plus long que les autres tests.
  test.setTimeout(240_000);
  // Alice crée une chasse à seuil 7, progression masquée, et s'engage.
  const alice = await newPerson(browser);
  await open(alice, "/");
  await connectWallet(alice);
  const url = await createHunt(alice, {
    title: "Parcours automatique",
    threshold: 7,
    hideProgress: true,
  });
  const huntId = url.split("/").pop()!;
  // Pass exigé pour s'engager : Alice a une invitation de départ.
  await getPass(alice, GENESIS[0]!);
  await open(alice, url);
  await commit(alice);
  await expect(alice.getByText("Progression masquée")).toBeVisible();

  // Cinq autres personnes s'engagent (par l'API) : 6 engagés.
  for (let i = 0; i < 5; i += 1) await apiCommit(request, huntId, GENESIS[1 + i]!);

  // Alice invite Bruno depuis « Mon pass » (lien à lui envoyer, ex. par Signal).
  await open(alice, "/pass");
  await alice.getByRole("button", { name: "Créer une invitation" }).click();
  const invitation = alice.getByRole("textbox", { name: "Lien d'invitation" });
  await expect(invitation).toHaveValue(/\/pass#/, { timeout: 30_000 });
  const inviteLink = await invitation.inputValue();

  // Bruno ouvre le lien partagé (autre appareil) et exige au moins 8 personnes.
  const bruno = await newPerson(browser);
  await getPass(bruno, inviteLink);
  await open(bruno, url);
  await connectWallet(bruno);
  await commit(bruno, 8);
  await expect(bruno.getByRole("status").filter({ hasText: "Ta condition" })).toContainText(
    "en attente",
  );
  // 7 engagés mais seulement 6 acceptent un groupe de 7 : pas encore activée.
  // Le serveur ne révèle pas le compteur d'une chasse masquée encore active.
  const masked = await (await request.get(`${API}/api/hunts/${huntId}`)).json();
  expect(masked).toMatchObject({ status: "active", commitCount: null, retainedCount: null });

  // Chloé s'engage : 8 personnes acceptent un groupe de 8, la chasse s'active, Bruno est retenu.
  const chloe = await newPerson(browser);
  await getPass(chloe, GENESIS[6]!);
  await open(chloe, url);
  await connectWallet(chloe);
  await commit(chloe);
  await expect(chloe.getByText("Seuil atteint", { exact: true })).toBeVisible();
  await reload(bruno);
  await expect(bruno.getByRole("status").filter({ hasText: "Ta condition" })).toContainText(
    "remplie",
  );

  // David s'engage après l'activation (engagements ouverts) mais exige 20 : non retenu.
  const david = await newPerson(browser);
  await getPass(david, GENESIS[7]!);
  await open(david, url);
  await connectWallet(david);
  await commit(david, 20);
  await expect(david.getByRole("status").filter({ hasText: "Ta condition" })).toContainText(
    "en attente",
  );
  await expect(david.getByText("Remboursement par non-retenu·e (1)")).toBeVisible();
  await expect(david.getByText("Récompense par engagé·e")).toBeVisible();

  // Le chat s'est ouvert tout seul au déclenchement : Bruno (retenu) et Alice
  // (créatrice) y ont accès sans rien activer ; David (non retenu) non.
  await reload(bruno);
  await expect(bruno.getByRole("link", { name: "Ouvrir le chat Matrix" })).toBeVisible();

  await open(alice, url);
  await expect(alice.getByRole("link", { name: "Ouvrir le chat Matrix" })).toBeVisible();

  await reload(david);
  await expect(david.getByText(/engagé·es retenu·es/)).toBeVisible();
  await expect(david.getByRole("link", { name: "Ouvrir le chat Matrix" })).toHaveCount(0);

  // Aucune réponse publique ne contient de seuil personnel ni d'empreinte.
  const pub = await (await request.get(`${API}/api/hunts/${huntId}`)).text();
  expect(pub).not.toContain("personalThreshold");
  expect(pub).not.toContain("creatorKey");
  expect(JSON.parse(pub)).toMatchObject({
    status: "activated",
    commitCount: 9,
    retainedCount: 8,
    commitsOpen: true,
  });

  // Aperçu riche du lien, rendu par le serveur (sans exécuter la page).
  const html = await (await request.get(url)).text();
  expect(html).toContain('property="og:title" content="Parcours automatique — Huntited"');
  expect(html).toContain("il faut au moins 7 personnes avant le");
});

test("sans pass, l'engagement est bloqué", async ({ browser }) => {
  const alice = await newPerson(browser);
  await open(alice, "/");
  await connectWallet(alice);
  const url = await createHunt(alice, { title: "Sans pass", threshold: 7 });

  const eve = await newPerson(browser);
  await open(eve, url);
  await connectWallet(eve);
  await eve.getByRole("button", { name: /S'engager/ }).click();
  const dialog = eve.getByRole("dialog");
  await expect(dialog.getByText(/Il te faut un pass Huntited/)).toBeVisible();
  await dialog.getByRole("checkbox").click();
  await expect(dialog.getByRole("button", { name: "Confirmer l'engagement" })).toBeDisabled();
});

test("répondre à un tweet ouvre X avec une réponse préremplie", async ({ browser }) => {
  const alice = await newPerson(browser);
  await open(alice, "/");
  await connectWallet(alice);
  const url = await createHunt(alice, { title: "Réponse X", threshold: 7 });

  // L'ouverture de X est interceptée : aucun accès réseau à x.com.
  await alice
    .context()
    .route("https://x.com/**", (route) => route.fulfill({ status: 200, body: "ok" }));
  await alice.getByRole("button", { name: "Répondre à un tweet" }).click();
  await alice.getByLabel("Adresse du tweet").fill("pas un tweet");
  await alice.getByRole("button", { name: "Ouvrir la réponse sur X" }).click();
  await expect(alice.getByRole("alert")).toContainText("Colle l'adresse d'un tweet");

  await alice.getByLabel("Adresse du tweet").fill("https://x.com/quelquun/status/1234567890");
  const [popup] = await Promise.all([
    alice.waitForEvent("popup"),
    alice.getByRole("button", { name: "Ouvrir la réponse sur X" }).click(),
  ]);
  const intent = new URL(popup.url());
  expect(intent.origin + intent.pathname).toBe("https://x.com/intent/tweet");
  expect(intent.searchParams.get("in_reply_to")).toBe("1234567890");
  expect(intent.searchParams.get("url")).toBe(url);
  expect(intent.searchParams.get("text")).toContain("« Réponse X »");
});
