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

- **Création de chasse** : titre, description, lieu, date limite, seuil de participants et dépôt fixe de 30 KAS (remboursé en cas de succès ; en cas d'échec, il finance d'abord le bonus des engagés). Parcours en deux temps : formulaire → récapitulatif → création.
- **Économie d'engagement** : Un engagement coûte 5 KAS. Si le seuil n'est pas atteint avant la deadline, le dépôt est remboursé intégralement, avec un bonus pouvant aller jusqu'à 1 KAS pris sur le dépôt du créateur. Si le seuil est atteint, le dépôt finance le créateur à 95 % et la treasury à 5 %. Détails : `docs/economics.md`.
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

### Front

```bash
bun install
bun run dev
# http://localhost:8080
```

### Backend (chat Matrix mocké)

```bash
cd backend
npm install
npm run dev
# http://localhost:3001 — endpoints : POST /api/chat, GET /api/chat/:huntId, GET /health
```

Variable d'environnement optionnelle : `FRONT_ORIGIN` (origine autorisée pour CORS).

## Principes non négociables

- **Privacy-first** : jamais de logs d'IP, d'emails ou de PII ; aucun `console.log` exposant huntId, lien d'invitation ou contenu saisi ; métadonnées chiffrées, liens éphémères.
- **Simplicité** : UX compréhensible par un non-crypto.
- **Résilience** : pas de point central de défaillance ni de contrôle.
