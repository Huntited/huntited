# Huntited

**Huntited** est un protocole de coordination décentralisé sur Kaspa, inspiré par Staghunt (hashd.ag). Il permet à des groupes de coordonner des actions collectives (manifestations, blocus, rassemblements) de façon :

- **Privée** — les engagements sont anonymisés (commitments SHA-256 ; compteur visible ou masqué au choix du créateur, masquage cryptographique via ZK à terme), aucune donnée personnelle n'est collectée ni logguée.
- **Atomique** — l'action se déclenche pour tout le monde ou pour personne : tant que le seuil n'est pas atteint, personne ne s'expose.
- **Sans maître** — aucun tiers de confiance : les règles sont portées par des covenants on-chain, pas par un administrateur.

## Stack

| Couche       | Technologie                                                                                                    |
| ------------ | -------------------------------------------------------------------------------------------------------------- |
| Front        | React 19 + TypeScript + Tailwind (TanStack Start, routage par fichiers)                                        |
| Backend chat | Express + TypeScript (ES modules), Matrix (Synapse auto-hébergé, sans fédération, E2EE) — mocké pour l'instant |
| On-chain     | Covenants Kaspa (pseudo-code Argent/Silverscript dans `contracts/`)                                            |

## Architecture

```text
.
├── src/
│   ├── routes/            # pages : /, /create, /create-review, /hunt/$id, /my-hunts
│   ├── components/hunt/   # CreateHuntForm, CommitModal, ChatPanel, ChatSection
│   ├── components/ui/     # Countdown, composants shadcn
│   └── lib/               # logique métier (voir ci-dessous)
├── backend/
│   └── src/               # serveur Express : routes /api/chat, /health
├── contracts/
│   └── HuntCovenant.arg   # covenant de chasse (pseudo-code Silverscript)
└── README.md
```

### Couche covenant (src/lib)

Le front ne parle jamais directement au mock : tout passe par `covenants.ts`, point d'injection unique. Brancher les vrais covenants Kaspa = réécrire uniquement ce fichier.

```text
UI → covenants.ts → mock-zk.ts (localStorage)
                 → registry.ts, user-hunts.ts, wallet.ts (mocks locaux)
```

## Fonctionnalités MVP (mockées)

- **Création de chasse** : titre, description, lieu, date limite, seuil de participants (7 au moins) et caution de 30 KAS au moins (au choix du créateur, qui n'y gagne jamais rien). Parcours en deux temps : formulaire → récapitulatif → création.
- **Économie d'engagement** : le dépôt d'engagement (5 KAS) est toujours rendu. En cas de succès seulement, le créateur récompense les engagés sur sa caution : 47,5 % de la caution au plus, plafonné à 1 KAS par engagé pour 30 KAS de caution ; 2,5 % à la treasury ; le reste lui est rendu. En cas d'échec : 1/30 de la caution à la treasury, le reste lui est rendu. Détails : `docs/economics.md`.
- **Pass Huntited (anti-bots)** : une personne = un engagement par chasse, prouvé anonymement (preuves Semaphore calculées sur l'appareil). On rejoint avec une invitation d'un membre (3 par mois, sans que le serveur sache qui invite qui). Détails : `docs/anti-bots.md` ; essai : `bun run dev:shared:pass`.
- **Pays** : chaque chasse indique son pays (code ISO, noms affichés dans la langue choisie) ; l'accueil se filtre par pays (seuls les pays ayant des chasses sont proposés).
- **Répondre à un tweet** : on colle l'adresse d'un tweet, X s'ouvre sur une réponse préremplie avec le lien de la chasse (aucune API X, l'utilisateur publie lui-même). Les liens de chasse ont un aperçu riche (titre, seuil, date limite ; image si `VITE_SITE_URL` est défini).
- **Engagement privé** : commitment = SHA-256(huntId | secret aléatoire). Seule l'empreinte est stockée ; dans ce prototype, le secret n'est pas conservé (il sera géré par le vrai wallet). L'adresse du wallet n'entre jamais dans l'empreinte.
- **Wallet mocké** : connexion/déconnexion, requis pour s'engager (et plus tard pour payer le dépôt).
- **Activation atomique** : statut Active / Activée / Expirée calculé depuis le seuil et la date limite.
- **Gouvernance du MVP** : pas de contestation on-chain ; charte éthique, risques documentés et signalement hors-chaîne.
- **Chat de coordination** : panneau par chasse + backend Express mocké (création de salon Matrix, expiration à la fin de la chasse).
- **Mes chasses** : historique local des chasses créées, indexé par adresse de wallet.

## Roadmap

1. **Front** (en cours) — parcours complet mocké : création, engagement, statuts, chat placeholder.
2. **Backend Matrix** — vrai Synapse auto-hébergé, salons E2EE créés à l'activation, détruits à l'expiration.
3. **Covenants Kaspa** — implémentation réelle de `contracts/HuntCovenant.arg` : dépôts bloqués, activation au seuil, redistribution.
4. **Indexer** — indexation des chasses et engagements on-chain, compteur public sans révéler les engagés.
5. **Audit** — revue de sécurité des covenants et du protocole ZK avant tout usage réel.

Une forme de veto des engagés pourra être étudiée après le MVP si l'usage en démontre le besoin.

## Démarrage

### Front seul (tout simulé dans le navigateur)

```bash
bun install
bun run dev
```

Par défaut (`VITE_DATA_MODE=local`), les chasses sont stockées dans le navigateur : idéal pour la démo, mais rien n'est partagé entre appareils.

### Tester à plusieurs (registre partagé, sans vrais KAS)

1. Backend : copier `backend/.env.example` en `backend/.env`, puis :
   ```bash
   cd backend
   bun install
   bun run dev
   ```
   - `REGISTRY_FILE=data/registry.json` conserve les chasses entre deux redémarrages.
   - `CORS_ORIGIN` : l'adresse du front, plusieurs séparées par des virgules
     (ajouter `http://<IP-du-PC>:<port>` pour tester depuis un téléphone sur le même Wi-Fi).
   - `WALLET_AUTH_MODE=mock` pour le wallet factice ; `signature` (défaut) pour Kastle.
2. Front : dans `.env`, `VITE_DATA_MODE=api`, `VITE_MATRIX_MODE=api`,
   `VITE_API_BASE_URL=http://<IP-du-PC>:3001` (et `VITE_WALLET_MODE=kastle` pour Kastle).
3. Ouvrir le front sur chaque appareil : créer, partager le lien, s'engager.
   Une seule signature du wallet par visite ouvre une session d'une heure.

### Tests

```bash
bun run test        # tests unitaires du front (Vitest)
bun run test:e2e    # parcours complet dans Chrome (Playwright) : backend + front dédiés
```

`test:e2e` démarre lui-même un backend et un front de test (ports 3099 et 5199,
registre en mémoire, wallet factice) et utilise le Chrome installé. Il simule
4 personnes : création, progression masquée, seuils personnels, activation,
accès au chat. Les tests du backend : `cd backend && bun run test`.

Routes du backend : `GET /health`, `GET|POST /api/hunts`, `GET /api/hunts/:id`,
`POST /api/hunts/:id/commit`, `GET /api/me`, `POST /api/auth/challenge|session|chat-access`,
`POST /api/chats`, `GET /api/chats/:huntId`, `GET /api/passes/config|group`,
`POST /api/passes/redeem|invitations`.

## Principes non négociables

- **Privacy-first** : jamais de logs d'IP, d'emails ou de PII ; aucun `console.log` exposant huntId, lien d'invitation ou contenu saisi ; métadonnées chiffrées, liens éphémères.
- **Simplicité** : UX compréhensible par un non-crypto.
- **Résilience** : pas de point central de défaillance ni de contrôle.
