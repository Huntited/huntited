# Économie de Huntited (MVP)

> Tes 5 KAS sont bloqués puis rendus à la fin, que l'action ait lieu ou non. Si elle a lieu, tu reçois en plus une récompense du créateur, jusqu'à 1 KAS.
>
> Le créateur bloque une caution de 30 KAS. Action réussie : jusqu'à 1 KAS par engagé (14,25 KAS au plus), 0,75 KAS à Huntited, il récupère le reste. Action annulée : 1 KAS à Huntited, il récupère 29 KAS.
>
> Une chasse demande au moins **7 personnes**.

## Cycle de vie d'une chasse

```text
Brouillon → Créée → Active → Seuil atteint / Activée → Chat Matrix ouvert → Résolution économique
```

- **Brouillon** : formulaire en cours, rien n'est déposé.
- **Créée** : 30 KAS verrouillés dans le covenant.
- **Active** : les engagements (5 KAS chacun) sont ouverts jusqu'à la deadline.
- **Seuil atteint / Activée** : activation atomique pour tous les engagés.
- **Chat Matrix ouvert** : salon chiffré éphémère, expire 24 h après la deadline.
- **Résolution économique** : flux ci-dessous (succès) ; une chasse qui expire sans atteindre le seuil passe directement à la résolution (échec).

Les badges (`src/lib/badges.ts`) et, plus tard, les missions, XP et niveaux sont des récompenses non financières : ils n'influencent jamais les paiements. Les badges sont privés par défaut ; chaque wallet choisit de les rendre visibles publiquement.

## Dépôts

- **Création d'une chasse** : caution de 30 KAS, déposée par le créateur.
- **Engagement** : 5 KAS, déposés par chaque engagé et **toujours rendus** à la fin.

## Récompense du créateur (succès uniquement)

| Issue                                          | Engagés                                          | Huntited | Rendu au créateur            |
| ---------------------------------------------- | ------------------------------------------------ | -------- | ---------------------------- |
| **Succès** (seuil atteint)                     | jusqu'à 1 KAS chacun, 14,25 KAS au plus au total | 0,75 KAS | le reste (de 15 à 22,25 KAS) |
| **Échec** (seuil non atteint à la date limite) | rien (dépôt rendu)                               | 1 KAS    | 29 KAS                       |

- Succès : seuls les engagé·es du **groupe retenu** sont récompensé·es. Un·e
  engagé·e non retenu·e (seuil personnel pas atteint, voir
  `docs/seuil-personnel.md`) récupère ses **5 KAS, sans récompense**.
- Parts égales : 14,25 KAS / N, plafonnées à 1 KAS (au-delà de 14 engagés, la
  part passe sous 1 KAS). Arrondi au sompi inférieur ; le reste revient au
  créateur.

Pourquoi :

- **Pas de récompense en cas d'échec** : engager des bots sur une chasse
  vouée à l'échec ne rapporte rien.
- **Plafond de 1 KAS par engagé** : un créateur qui s'engage avec ses propres
  wallets récupère au plus 1 KAS par wallet.
- **1 KAS de frais en cas d'échec** : lancer des chasses à la chaîne coûte
  quelque chose.
- S'engager ne fait jamais perdre d'argent (dépôt toujours rendu).

## Seuil minimum : 7 personnes

Une chasse demande au moins 7 personnes : des actions vraiment collectives, et
une récompense plus difficile à récupérer avec ses propres wallets. Le seuil
minimum est appliqué par le formulaire, par le serveur et par le covenant.

## Exemples (succès)

| Engagés | Récompense par engagé | Rendu au créateur |
| ------- | --------------------- | ----------------- |
| 7       | 1 KAS                 | 22,25 KAS         |
| 10      | 1 KAS                 | 19,25 KAS         |
| 20      | 0,7125 KAS            | 15 KAS            |
| 60      | ≈ 0,24 KAS            | 15 KAS            |

Tous les calculs sont faits en sompis (1 KAS = 10^8 sompis), sans nombre à virgule.

## Limite connue

Les bots peuvent encore gonfler le nombre d'engagés et provoquer un faux
déclenchement (l'action se lance avec moins de vraies personnes que prévu).
La parade prévue : une personne = un engagement, prouvé anonymement (voir
`docs/anti-bots.md`). À traiter avant tout usage réel.

## Gouvernance et abus (MVP)

Pas de contestation on-chain. Protection via la charte éthique, une documentation transparente et des signalements hors-chaîne.

Aucun remboursement à la demande : les flux dépendent uniquement du résultat on-chain (succès ou échec).
