// Parcours complet à plusieurs personnes, contre le vrai backend (registre
// partagé, sessions signées par le wallet factice, chat simulé).
import { expect, test } from "@playwright/test";

import {
  commit,
  connectWallet,
  createHunt,
  fillCreateForm,
  newPerson,
  open,
  reload,
} from "./helpers";

const API = "http://localhost:3099";

test("création impossible sans wallet", async ({ page }) => {
  await fillCreateForm(page, { title: "Sans wallet", threshold: 2 });
  await expect(page.getByRole("button", { name: "Connecter le wallet" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirmer et créer la chasse" })).toHaveCount(0);
});

test("parcours à 4 : progression masquée, seuils personnels, activation, chat", async ({
  browser,
  request,
}) => {
  // Alice crée une chasse à seuil 2, progression masquée, et s'engage.
  const alice = await newPerson(browser);
  await open(alice, "/");
  await connectWallet(alice);
  const url = await createHunt(alice, {
    title: "Parcours automatique",
    threshold: 2,
    hideProgress: true,
  });
  const huntId = url.split("/").pop()!;
  await commit(alice);
  await expect(alice.getByText("Progression masquée")).toBeVisible();

  // Bruno ouvre le lien partagé (autre appareil) et exige au moins 3 personnes.
  const bruno = await newPerson(browser);
  await open(bruno, url);
  await connectWallet(bruno);
  await commit(bruno, 3);
  await expect(bruno.getByRole("status").filter({ hasText: "Ta condition" })).toContainText(
    "en attente",
  );
  // Le serveur ne révèle pas le compteur d'une chasse masquée encore active.
  const masked = await (await request.get(`${API}/api/hunts/${huntId}`)).json();
  expect(masked).toMatchObject({ status: "active", commitCount: null, retainedCount: null });

  // Chloé s'engage : le groupe {2, 3, 2} se forme, la chasse s'active, Bruno est retenu.
  const chloe = await newPerson(browser);
  await open(chloe, url);
  await connectWallet(chloe);
  await commit(chloe);
  await expect(chloe.getByText("Seuil atteint", { exact: true })).toBeVisible();
  await reload(bruno);
  await expect(bruno.getByRole("status").filter({ hasText: "Ta condition" })).toContainText(
    "remplie",
  );

  // David s'engage après l'activation (engagements ouverts) mais exige 10 : non retenu.
  const david = await newPerson(browser);
  await open(david, url);
  await connectWallet(david);
  await commit(david, 10);
  await expect(david.getByRole("status").filter({ hasText: "Ta condition" })).toContainText(
    "en attente",
  );
  await expect(david.getByText("Remboursement par non-retenu·e (1)")).toBeVisible();

  // Alice (créatrice) ouvre le chat ; Bruno (retenu) le voit ; David (non retenu) non.
  await reload(alice);
  await alice.getByRole("button", { name: "Activer le chat" }).click();
  await expect(alice.getByRole("link", { name: "Ouvrir le chat Matrix" })).toBeVisible();

  await reload(bruno);
  await expect(bruno.getByRole("link", { name: "Ouvrir le chat Matrix" })).toBeVisible();

  await reload(david);
  await expect(david.getByText(/engagé·es retenu·es/)).toBeVisible();
  await expect(david.getByRole("link", { name: "Ouvrir le chat Matrix" })).toHaveCount(0);

  // Aucune réponse publique ne contient de seuil personnel ni d'empreinte.
  const pub = await (await request.get(`${API}/api/hunts/${huntId}`)).text();
  expect(pub).not.toContain("personalThreshold");
  expect(pub).not.toContain("creatorKey");
  expect(JSON.parse(pub)).toMatchObject({
    status: "activated",
    commitCount: 4,
    retainedCount: 3,
    commitsOpen: true,
  });
});
