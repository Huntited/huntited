# Économie de Huntited (MVP)

> Un engagement coûte 5 KAS. Si le seuil n'est pas atteint avant la deadline, le dépôt est remboursé intégralement, avec un bonus pouvant aller jusqu'à 1 KAS pris sur le dépôt du créateur. Si le seuil est atteint, le dépôt finance le créateur à 95 % et la treasury à 5 %.
>
> Le dépôt de création de 30 KAS est remboursé au créateur si le seuil est atteint. Sinon, il verse d'abord 1 KAS de bonus à chaque engagé (30 KAS au plus, partagés au-delà de 30 engagés) et le créateur récupère le reste.

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

## Succès (seuil atteint avant la deadline)

- Les **30 KAS de création** sont rendus à 100 % au créateur.
- Le total des **dépôts d'engagement** (5 KAS × N) est réparti :
  - **95 %** au créateur ;
  - **5 %** à la treasury.
- Les engagé·es reçoivent **0 KAS**.

Le dépôt de création n'entre jamais dans la répartition 95/5.

## Échec (seuil non atteint)

- Chaque engagé récupère 100 % de ses 5 KAS **plus un bonus d'échec de 1 KAS**.
- Le bonus est pris sur le dépôt de création : son total est plafonné à 30 KAS.
  Au-delà de 30 engagés, les 30 KAS sont partagés à parts égales (arrondi au
  sompi inférieur ; le reste revient au créateur).
- Le créateur récupère ce qui reste de ses 30 KAS.
- La treasury reçoit 0 KAS.

Pourquoi : s'engager devient avantageux même si la chasse échoue (principe du
« contrat d'assurance dominant »), et un créateur ne lance que des chasses
auxquelles il croit, puisqu'un échec lui coûte jusqu'à 30 KAS.

## Exemples

| Engagés | Engagements | Succès : créateur    | Succès : treasury | Échec : par engagé | Échec : créateur |
| ------- | ----------- | -------------------- | ----------------- | ------------------ | ---------------- |
| 10      | 50 KAS      | 30 + 47,5 = 77,5 KAS | 2,5 KAS           | 5 + 1 = 6 KAS      | 20 KAS           |
| 20      | 100 KAS     | 30 + 95 = 125 KAS    | 5 KAS             | 5 + 1 = 6 KAS      | 10 KAS           |
| 60      | 300 KAS     | 30 + 285 = 315 KAS   | 15 KAS            | 5 + 0,5 = 5,5 KAS  | 0 KAS            |

Tous les calculs sont faits en sompis (1 KAS = 10^8 sompis), sans nombre à virgule.

## Gouvernance et abus (MVP)

Pas de contestation on-chain. Protection via la charte éthique, une documentation transparente et des signalements hors-chaîne.

Aucun remboursement à la demande : les flux dépendent uniquement du résultat on-chain (succès ou échec).
