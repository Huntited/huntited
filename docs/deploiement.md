# Mettre Huntited en ligne (prototype, testnet, sans vrais KAS)

Objectif : permettre à des personnes hors de ton Wi-Fi de tester, chacune avec
son navigateur et son wallet Kastle sur **testnet-10**. Aucun KAS n'est
déplacé ; seules des signatures de messages sont demandées.

## Architecture

```text
Navigateur ──HTTPS──► Front (site statique / worker)
     │
     └──HTTPS──► Backend Huntited (Express) ──► fichier registry.json (volume persistant)
```

- **Front** : build Vite / TanStack Start (`bun run build`). Peut être publié
  par tout hébergeur compatible (Cloudflare par défaut).
- **Backend** : image Docker (`backend/Dockerfile`), un seul conteneur, avec un
  **volume persistant** monté sur `/app/data` (sinon les chasses sont perdues
  à chaque redéploiement).
- Les deux doivent être en **HTTPS** (Kastle et les navigateurs l'exigent hors
  `localhost`).

## Variables du backend (production)

| Variable                   | Valeur                                   | Remarque                                                             |
| -------------------------- | ---------------------------------------- | -------------------------------------------------------------------- |
| `NODE_ENV`                 | `production`                             | déjà fixé dans l'image                                               |
| `PORT`                     | `3001` (ou celui imposé par l'hébergeur) |                                                                      |
| `CORS_ORIGIN`              | `https://<adresse-du-front>`             | plusieurs séparées par des virgules                                  |
| `AUTH_JWT_SECRET`          | 48+ caractères aléatoires                | **secret** : à générer, jamais commité                               |
| `AUTH_TOKEN_TTL_SECONDS`   | `900`                                    | jeton de chat                                                        |
| `AUTH_SESSION_TTL_SECONDS` | `3600`                                   | session signée                                                       |
| `KASPA_NETWORK`            | `testnet-10`                             | seule valeur acceptée                                                |
| `WALLET_AUTH_MODE`         | `signature`                              | `mock` est refusé en production                                      |
| `REGISTRY_FILE`            | `/app/data/registry.json`                | déjà fixé dans l'image                                               |
| `TRUST_PROXY`              | `1`                                      | derrière le proxy de l'hébergeur (limites de fréquence par visiteur) |
| `RATE_LIMIT_MULTIPLIER`    | `1`                                      | à augmenter si beaucoup de monde partage une IP (box, 4G)            |
| `PASS_REQUIRED`            | `true` (défaut en production)            | pass exigé pour s'engager (anti-bots, `docs/anti-bots.md`)           |
| `PASS_FILE`                | `/app/data/passes.json`                  | empreintes anonymes des pass                                         |
| `PASS_GENESIS_INVITES`     | quelques codes aléatoires (24+ car.)     | **secret** : invitations de départ, à donner aux premiers membres    |
| `PASS_INVITES_PER_MONTH`   | `3`                                      | invitations par pass et par mois                                     |
| `MATRIX_MODE`              | `mock`                                   | Synapse réel pas encore branché                                      |
| `MATRIX_HOMESERVER_URL`    | URL publique prévue                      |                                                                      |

Générer un secret (PowerShell, générateur cryptographique) :

```powershell
$b = New-Object byte[] 48; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b)
```

## Variables du front (au moment du build)

| Variable                     | Valeur                         |
| ---------------------------- | ------------------------------ |
| `VITE_DATA_MODE`             | `api`                          |
| `VITE_MATRIX_MODE`           | `api`                          |
| `VITE_WALLET_MODE`           | `kastle`                       |
| `VITE_API_BASE_URL`          | `https://<adresse-du-backend>` |
| `VITE_MATRIX_HOMESERVER_URL` | URL publique prévue            |

Les variables `VITE_*` sont **publiques** (intégrées au site) : n'y mets jamais
de secret.

## Vérifications après déploiement

1. `https://<backend>/health` répond `{"status":"ok"}`.
2. Le front affiche la liste (vide au début) sans erreur.
3. Dérouler `docs/test-kastle.md` avec l'adresse en ligne à la place de
   `localhost`.
4. Redéployer le backend : les chasses créées sont toujours là (volume OK).

## Limites connues du prototype en ligne

- Un seul conteneur backend (le registre est un fichier) : pas de mise à
  l'échelle horizontale.
- L'opérateur du serveur peut voir le nombre d'engagés des chasses masquées.
- « Mes chasses » et le rang des engagements restent mémorisés par appareil.
- Pas de sauvegarde automatique du fichier : à prévoir selon l'hébergeur.
