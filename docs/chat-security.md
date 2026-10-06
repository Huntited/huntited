# Sécurité du chat Huntited

## Qui accède au chat

| État de la hunt  | Créateur·rice                 | Engagé·e                      | Externe     |
| ---------------- | ----------------------------- | ----------------------------- | ----------- |
| Active           | Pas de chat                   | Pas de chat                   | Aucun accès |
| Activée          | Peut ouvrir le chat           | Peut rejoindre un chat ouvert | Aucun accès |
| Expirée          | Pas de chat                   | Pas de chat                   | Aucun accès |
| Résolue — succès | Accessible jusqu'à expiration | Accessible jusqu'à expiration | Aucun accès |
| Résolue — échec  | Pas de chat                   | Pas de chat                   | Aucun accès |

## Comment ça marche

1. Le wallet est connecté.
2. Le front demande au backend un **jeton d'accès court** (15 min par défaut) pour une hunt précise.
3. Le backend vérifie que la hunt est activée (ou résolue en succès) et que le wallet est créateur·rice ou engagé·e.
4. Chaque appel au chat présente ce jeton. Un jeton ne vaut que pour **une seule hunt**.

Le jeton reste en mémoire dans la page : il n'est jamais enregistré dans le navigateur et disparaît à expiration ou à la déconnexion du wallet.

## Ce qui ne circule jamais

- Aucune clé privée ni seed phrase n'est transmise.
- Le token du bot Matrix reste côté serveur (`backend/.env`), jamais dans une variable `VITE_`.
- Matrix ne reçoit jamais le wallet : chaque personne a un compte temporaire propre à la chasse (identifiant aléatoire), supprimé avec le salon. Le lien vers Element contient l'identifiant du salon, accessible seulement aux comptes invités (voir `docs/matrix.md`).
- Les identifiants temporaires ne sont remis qu'à la personne concernée et ne sont jamais enregistrés sur l'appareil.
- Les logs ne contiennent que des événements anonymes (`chat_created`, `chat_expired`).

## Limite du MVP (mock)

Aujourd'hui, l'adresse du wallet est **simplement déclarée** pour obtenir un jeton : acceptable en développement seulement. En production, le flux deviendra :

```text
Backend → challenge unique
Wallet Kaspa → signe ce challenge
Backend → vérifie la signature
Backend → émet le jeton d'accès court
```

L'état des hunts et les rôles viennent d'un store mémoire de développement ; ils viendront de l'état du covenant Kaspa (ou d'un indexer).

## Salons éphémères

Les salons expirent 24 h après la date limite de la hunt : ils sont supprimés (historique purgé) et les comptes temporaires désactivés et effacés.
