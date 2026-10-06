# Économie de Huntited (MVP)

> S'engager coûte 5 KAS. Si l'action a lieu, tes 5 KAS vont au créateur (95 %) et à Huntited (5 %), et tu reçois ta part des 28,5 KAS de la caution du créateur. Si elle n'a pas lieu (pas assez de monde à la date limite), tu récupères tes 5 KAS, plus ta part des 14,25 KAS de la caution.
>
> Le créateur bloque une caution de 30 KAS, partagée avec les engagés. Si l'action a lieu, 95 % de la caution (28,5 KAS) est partagée entre les engagés et 5 % va à Huntited. Sinon, 47,5 % (14,25 KAS) est partagée entre les engagés, 2,5 % va à Huntited et le créateur récupère la moitié.
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

- **Création d'une chasse** : 30 KAS, déposés par le créateur.
- **Engagement** : 5 KAS, déposés par chaque engagé.

## Seuil minimum : 7 personnes

En cas de succès, le créateur abandonne sa caution (30 KAS) et reçoit 95 % des
engagements. Il faut donc au moins 7 engagés pour qu'il ne perde pas d'argent
quand son action réussit : 95 % × 7 × 5 KAS = 33,25 KAS ≥ 30 KAS. Le seuil
minimum est appliqué par le formulaire, par le serveur et par le covenant.

## Succès (seuil atteint avant la deadline)

- Le total des **dépôts d'engagement** (5 KAS × N retenu·es) est réparti :
  - **95 %** au créateur ;
  - **5 %** à la treasury.
- La **caution de 30 KAS** est répartie :
  - **95 % (28,5 KAS)** partagés à parts égales entre les engagé·es retenu·es ;
  - **5 % (1,5 KAS)** à la treasury.

**Seuil personnel** (voir `docs/seuil-personnel.md`) : seuls les engagé·es du
**groupe retenu** (dont la condition « au moins N personnes » est remplie)
financent la répartition 95/5 et reçoivent une part de la caution. Un·e
engagé·e non retenu·e récupère ses **5 KAS, sans part de la caution**.

## Échec (seuil non atteint)

- Chaque engagé récupère 100 % de ses 5 KAS.
- La **caution de 30 KAS** est répartie :
  - **47,5 % (14,25 KAS)** partagés à parts égales entre tous les engagés ;
  - **2,5 % (0,75 KAS)** à la treasury (frais de maintenance) ;
  - **50 % (15 KAS)** rendus au créateur.

Les parts sont arrondies au sompi inférieur ; le reste de l'arrondi, et toute
part sans destinataire (aucun engagé), revient au créateur.

Pourquoi : s'engager rapporte une part de la caution dans tous les cas, et ne
coûte rien si l'action n'a pas lieu (principe du « contrat d'assurance
dominant »). Un créateur ne lance que des chasses auxquelles il croit,
puisqu'un échec lui coûte 15 KAS.

## Exemples

| Engagés | Succès : créateur (gain net) | Succès : part par engagé | Succès : treasury | Échec : par engagé | Échec : créateur | Échec : treasury |
| ------- | ---------------------------- | ------------------------ | ----------------- | ------------------ | ---------------- | ---------------- |
| 7       | 33,25 KAS (+3,25)            | ≈ 4,07 KAS               | 3,25 KAS          | 5 + ≈ 2,04 KAS     | 15 KAS           | 0,75 KAS         |
| 10      | 47,5 KAS (+17,5)             | 2,85 KAS                 | 4 KAS             | 5 + 1,425 KAS      | 15 KAS           | 0,75 KAS         |
| 20      | 95 KAS (+65)                 | 1,425 KAS                | 6,5 KAS           | 5 + 0,7125 KAS     | 15 KAS           | 0,75 KAS         |
| 60      | 285 KAS (+255)               | 0,475 KAS                | 16,5 KAS          | 5 + 0,2375 KAS     | 15 KAS           | 0,75 KAS         |

Tous les calculs sont faits en sompis (1 KAS = 10^8 sompis), sans nombre à virgule.

## Limite connue

Un créateur peut s'engager avec ses propres wallets pour récupérer une partie
de la caution. Ce contournement existait déjà avec l'ancien bonus d'échec ; il
devra être traité avant tout usage réel (KAS réels).

## Gouvernance et abus (MVP)

Pas de contestation on-chain. Protection via la charte éthique, une documentation transparente et des signalements hors-chaîne.

Aucun remboursement à la demande : les flux dépendent uniquement du résultat on-chain (succès ou échec).
