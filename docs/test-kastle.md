# Tester Huntited avec Kastle (testnet, sans vrais KAS)

Ce test valide le seul maillon jamais essayé en vrai : la connexion et la
signature avec l'extension Kastle. **Aucune transaction n'est faite** : tu n'as
besoin d'aucun KAS, seulement de signer des messages.

> ⚠️ Ne communique jamais ta phrase de récupération ni ta clé privée, à
> personne (moi compris). Huntited ne te les demandera jamais.

## 1. Préparer deux « personnes »

Kastle est une extension pour navigateur d'ordinateur : on simule deux
personnes avec **deux profils Chrome**.

1. Dans Chrome, crée un second profil (icône de profil en haut à droite →
   « Ajouter »). Appelle-les **Profil A** et **Profil B**.
2. Dans chaque profil, installe l'extension **Kastle** depuis le Chrome Web
   Store, crée un wallet (un différent par profil).
3. Dans chaque Kastle, passe le réseau sur **testnet-10**.

## 2. Lancer Huntited en mode partagé

Dans un terminal, dossier du projet :

```bash
bun run dev:shared:duo
```

`duo` abaisse le seuil minimum à 2 (au lieu de 7) pour pouvoir activer une
chasse avec seulement deux profils. Ce réglage n'existe qu'en développement.

Deux fenêtres s'ouvrent (backend et front). Si Windows demande d'autoriser
Node sur le réseau, accepte (réseau privé).

## 3. Scénario à dérouler

| #   | Où       | Action                                                                                                           | Résultat attendu                                                                                                                                                                       |
| --- | -------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Profil A | Ouvrir `http://localhost:5173`, cliquer **Connecter le wallet**                                                  | Kastle demande l'autorisation ; après accord, une adresse `kaspatest:…` s'affiche                                                                                                      |
| 2   | Profil A | **Créer une chasse** : seuil 2, cocher « Masquer la progression », confirmer                                     | Kastle demande de **signer un message**. Vérifie qu'il contient ton adresse, `Network: kaspa:testnet-10` et « This signature does not send any KAS ». Signe : tu arrives sur la chasse |
| 3   | Profil A | **S'engager**                                                                                                    | Pas de nouvelle signature (session d'une heure). Le bouton devient « Déjà engagé·e », la progression reste masquée                                                                     |
| 4   | Profil A | **Partager**                                                                                                     | « Lien copié »                                                                                                                                                                         |
| 5   | Profil B | Coller le lien, **Connecter le wallet**, **S'engager**, signer                                                   | La chasse passe à **« Seuil atteint »** (2 sur 2)                                                                                                                                      |
| 6   | Profil A | Recharger la page (Kastle redemande une signature : normal, la session vit en mémoire), puis **Activer le chat** | Un bouton « Ouvrir le chat Matrix » apparaît (chat simulé)                                                                                                                             |
| 7   | Profil B | Recharger la page et signer                                                                                      | Le même bouton « Ouvrir le chat Matrix » apparaît                                                                                                                                      |

### Cas d'erreur à essayer ensuite

| Action                                                                                | Résultat attendu                          |
| ------------------------------------------------------------------------------------- | ----------------------------------------- |
| Refuser la connexion dans Kastle                                                      | Message « Connexion refusée dans Kastle » |
| Refuser une signature (déconnecte puis reconnecte le wallet, puis tente de t'engager) | Message « Signature refusée… »            |
| Passer Kastle sur **mainnet** alors que tu es connecté                                | Le site te déconnecte                     |
| Changer de compte dans Kastle                                                         | Le site affiche le nouveau compte         |

## 4. Ce qu'il faut me rapporter

- Le numéro de l'étape qui ne se passe pas comme prévu.
- Le message affiché (une capture d'écran de la page suffit).
- La version de Kastle (dans ses réglages).
- Si tu utilises un **Ledger** avec Kastle : dis-le, sa signature n'a pas
  encore été vérifiée.

Pour tout arrêter : ferme les deux fenêtres ouvertes à l'étape 2. Les chasses
de test sont gardées dans `backend/data/registry.json` (supprime ce fichier
pour repartir de zéro).
