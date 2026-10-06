# Économie de Huntited (MVP)

> Tes 5 KAS sont bloqués puis rendus à la fin, que l'action ait lieu ou non. Si elle a lieu, tu reçois en plus une récompense du créateur, jusqu'à 1 KAS pour 30 KAS de caution.
>
> Le créateur bloque une caution de **30 KAS au moins** (il peut en mettre plus) et **n'y gagne jamais rien** : on lui en rend une partie. Action réussie : 47,5 % de la caution partagés entre les engagés (au plus 1 KAS par engagé pour 30 KAS de caution), 2,5 % à Huntited, le reste lui est rendu. Action annulée : 1/30 de la caution à Huntited, le reste lui est rendu.
>
> Une chasse demande au moins **7 personnes**.

## Cycle de vie d'une chasse

```text
Brouillon → Créée → Active → Seuil atteint / Activée → Chat Matrix ouvert → Résolution économique
```

- **Brouillon** : formulaire en cours, rien n'est déposé.
- **Créée** : la caution (30 KAS au moins) est verrouillée dans le covenant.
- **Active** : les engagements (5 KAS chacun) sont ouverts jusqu'à la deadline.
- **Seuil atteint / Activée** : activation atomique pour tous les engagés.
- **Chat Matrix ouvert** : salon chiffré éphémère, expire 24 h après la deadline.
- **Résolution économique** : flux ci-dessous (succès) ; une chasse qui expire sans atteindre le seuil passe directement à la résolution (échec).

Les badges (`src/lib/badges.ts`) et, plus tard, les missions, XP et niveaux sont des récompenses non financières : ils n'influencent jamais les paiements. Les badges sont privés par défaut ; chaque wallet choisit de les rendre visibles publiquement.

## Dépôts

- **Création d'une chasse** : caution de 30 KAS au moins, au choix du créateur.
- **Engagement** : 5 KAS, déposés par chaque engagé et **toujours rendus** à la fin.

## Récompense du créateur (succès uniquement)

Tout est proportionnel à la caution C (30 KAS au moins) :

| Issue                                          | Engagés                                           | Huntited   | Rendu au créateur             |
| ---------------------------------------------- | ------------------------------------------------- | ---------- | ----------------------------- |
| **Succès** (seuil atteint)                     | 47,5 % de C au plus, plafonné à C / 30 par engagé | 2,5 % de C | le reste (au moins 50 % de C) |
| **Échec** (seuil non atteint à la date limite) | rien (dépôt rendu)                                | C / 30     | le reste                      |

| Caution | Plafond par engagé | Engagés au plus | Huntited (succès / échec) | Rendu si échec |
| ------- | ------------------ | --------------- | ------------------------- | -------------- |
| 30 KAS  | 1 KAS              | 14,25 KAS       | 0,75 / 1 KAS              | 29 KAS         |
| 60 KAS  | 2 KAS              | 28,5 KAS        | 1,5 / 2 KAS               | 58 KAS         |
| 150 KAS | 5 KAS              | 71,25 KAS       | 3,75 / 5 KAS              | 145 KAS        |

- **Le créateur ne gagne jamais rien** : on lui rend une partie de sa
  caution, au plus la totalité. Une caution plus élevée récompense davantage
  les engagés et montre le sérieux de la chasse.
- Succès : seuls les engagé·es du **groupe retenu** sont récompensé·es. Un·e
  engagé·e non retenu·e (seuil personnel pas atteint, voir
  `docs/seuil-personnel.md`) récupère ses **5 KAS, sans récompense**.
- Parts égales : (47,5 % de C) / N, plafonnées à C / 30. Arrondi au sompi
  inférieur ; le reste est rendu au créateur.

Pourquoi :

- **Pas de récompense en cas d'échec** : engager des bots sur une chasse
  vouée à l'échec ne rapporte rien.
- **Plafond par engagé** : un créateur qui s'engage avec ses propres wallets
  récupère au plus C / 30 par wallet (et le pass limite à un engagement par
  personne, voir `docs/anti-bots.md`).
- **Frais en cas d'échec** : lancer des chasses à la chaîne coûte quelque chose.
- S'engager ne fait jamais perdre d'argent (dépôt toujours rendu).

## Seuil minimum : 7 personnes

Une chasse demande au moins 7 personnes : des actions vraiment collectives, et
une récompense plus difficile à récupérer avec ses propres wallets. Le seuil
minimum est appliqué par le formulaire, par le serveur et par le covenant.

## Exemples (succès, caution de 30 KAS)

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
