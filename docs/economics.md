# Économie de Huntited (MVP)

> Tes 5 KAS sont bloqués puis rendus à la fin, que l'action ait lieu ou non. En plus, tu reçois ta part de la récompense du créateur : 14,25 KAS à partager si l'action a lieu, 19 KAS si elle est annulée.
>
> Le créateur bloque une caution de 30 KAS. Action réussie : 14,25 KAS aux engagés, 0,75 KAS à Huntited, il récupère 15 KAS. Action annulée : 19 KAS aux engagés, 1 KAS à Huntited, il récupère 10 KAS.
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

## Récompense du créateur

Le créateur finance une récompense prise sur sa caution, partagée **95 %** à
parts égales entre les engagés et **5 %** à la treasury (frais de maintenance).

| Issue                                          | Récompense | Engagés (95 %) | Treasury (5 %) | Rendu au créateur |
| ---------------------------------------------- | ---------- | -------------- | -------------- | ----------------- |
| **Succès** (seuil atteint)                     | 15 KAS     | 14,25 KAS      | 0,75 KAS       | 15 KAS            |
| **Échec** (seuil non atteint à la date limite) | 20 KAS     | 19 KAS         | 1 KAS          | 10 KAS            |

- Succès : seuls les engagé·es du **groupe retenu** reçoivent une part. Un·e
  engagé·e non retenu·e (seuil personnel pas atteint, voir
  `docs/seuil-personnel.md`) récupère ses **5 KAS, sans part**.
- Les parts sont arrondies au sompi inférieur ; le reste de l'arrondi, et
  toute part sans destinataire (aucun engagé), revient au créateur.

Pourquoi : s'engager ne fait jamais perdre d'argent et rapporte toujours une
part (principe du « contrat d'assurance dominant »). Créer coûte 15 KAS si
l'action réussit, 20 KAS si elle échoue : le créateur a intérêt à ne lancer
que des chasses crédibles, et à les faire réussir.

## Seuil minimum : 7 personnes

Une chasse demande au moins 7 personnes : des actions vraiment collectives, et
une récompense plus difficile à récupérer avec ses propres wallets. Le seuil
minimum est appliqué par le formulaire, par le serveur et par le covenant.

## Exemples (part par engagé)

| Engagés | Succès         | Échec          |
| ------- | -------------- | -------------- |
| 7       | 5 + ≈ 2,04 KAS | 5 + ≈ 2,71 KAS |
| 10      | 5 + 1,425 KAS  | 5 + 1,9 KAS    |
| 20      | 5 + 0,7125 KAS | 5 + 0,95 KAS   |
| 60      | 5 + 0,2375 KAS | 5 + ≈ 0,32 KAS |

Tous les calculs sont faits en sompis (1 KAS = 10^8 sompis), sans nombre à virgule.

## Limite connue

Un créateur peut s'engager avec ses propres wallets pour récupérer une partie
de la récompense. Le minimum de 7 personnes limite ce contournement sans le
supprimer : il devra être traité avant tout usage réel (KAS réels).

## Gouvernance et abus (MVP)

Pas de contestation on-chain. Protection via la charte éthique, une documentation transparente et des signalements hors-chaîne.

Aucun remboursement à la demande : les flux dépendent uniquement du résultat on-chain (succès ou échec).
