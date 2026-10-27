# Huntited

**Tout le monde ou personne.** Huntited permet de s'engager à agir _si
assez d'autres le font aussi_ : nettoyer une plage, changer d'appli
ensemble, lancer un projet, prendre la parole… Seul·e, c'est risqué ;
ensemble, ça marche. Tant que le seuil n'est pas atteint, personne ne
s'expose.

> _Everyone or no one._ Huntited lets people commit to act only if enough
> others do too. Threshold coordination on Kaspa, inspired by
> [Project Staghunt](https://hashd.ag/project-staghunt-six-pager.pdf).

- Site : **[huntited.com](https://huntited.com)** (statique, sans serveur)
- Appli Android **Huntited Chat** :
  [codeberg.org/Huntited/huntited-chat](https://codeberg.org/Huntited/huntited-chat)
  (fork GPL de bitchat : salons chiffrés, Bluetooth sans internet)

⚠️ **Prototype sur le réseau de test de Kaspa (testnet-10).** Les KAS de
test n'ont aucune valeur ; dépôts et cautions sont simulés.

## Comment ça marche

1. Quelqu'un crée une **chasse** : une action, une date limite et un seuil
   (« on y va si on est au moins 15 »).
2. Chacun **s'engage** de son côté, avec son propre seuil s'il le souhaite
   (« je viens si on est au moins 30 »). La progression n'est jamais
   affichée avant le déclenchement.
3. Dès qu'un groupe dont tous les seuils sont atteints existe, la chasse
   **se déclenche pour tout le monde en même temps**. Un salon chiffré,
   réservé aux membres, s'ouvre pour s'organiser.
4. Sinon, rien ne se passe et personne ne s'est exposé.

On peut **retirer** son engagement jusqu'au déclenchement, et
**enchaîner** des chasses (« je m'engage dans B seulement si A s'est
déclenchée »).

## Architecture

| Partie           | Technologie                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Site             | React 19, TypeScript, TanStack Router, Tailwind ; version statique servie par Codeberg Pages et copiée sur IPFS          |
| Registre         | Transactions Kaspa (testnet-10) vers une adresse commune, avec un message `HNT1…` ; état recalculé par chaque navigateur |
| Wallet           | Wallet intégré (BIP39, signature Schnorr, envoi par wRPC) ; Kastle en option                                             |
| Salons           | Messages chiffrés de bout en bout sur des relais Nostr ; relayés aussi par Bluetooth dans l'appli                        |
| Versions du site | Chaque version publiée est ancrée sur Kaspa (empreinte des fichiers) et vérifiable depuis le site                        |

Il n'y a **aucun serveur Huntited** : chaque navigateur relit le registre
sur l'API publique de Kaspa et recalcule l'état des chasses
(`src/lib/onchain/`, testé dans `ledger.test.ts`).

## Développement

```bash
npm install
npm run dev            # site en développement (chasses de démonstration)
npm test               # tests (vitest)
npm run lint
npm run build:static   # version statique dans dist-static/ (registre de test)
npm run routes         # après avoir ajouté ou supprimé une page dans src/routes
```

Le code est commenté en français. Documentation détaillée dans
[`docs/`](docs) : registre ([registre-kaspa.md](docs/registre-kaspa.md)),
seuils personnels ([seuil-personnel.md](docs/seuil-personnel.md)),
retrait et chasses enchaînées
([chasses-enchainees.md](docs/chasses-enchainees.md)), salons
([chat.md](docs/chat.md)), wallet ([wallet.md](docs/wallet.md)), missions
([missions.md](docs/missions.md)), appli ([app.md](docs/app.md)).

Règles du projet : [`AGENTS.md`](AGENTS.md).

## Licence

[GNU AGPL-3.0](LICENSE) ou ultérieure. Toute version modifiée mise en ligne
doit publier son code source.
