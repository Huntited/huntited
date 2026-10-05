# Économie de Huntited (MVP)

> Un engagement coûte 5 KAS. Si le seuil n'est pas atteint avant la deadline, le dépôt est remboursé intégralement. Si le seuil est atteint, le dépôt finance le créateur à 95 % et la treasury à 5 %.
>
> Le dépôt de création de 30 KAS est remboursé au créateur dans les deux scénarios MVP.

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

Les missions, XP, niveaux et badges restent des récompenses non financières futures : ils n'influencent jamais les paiements.

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

- Le créateur récupère 100 % de ses 30 KAS.
- Chaque engagé récupère 100 % de ses 5 KAS.
- La treasury reçoit 0 KAS.

## Exemples

| Engagés | Engagements | Succès : créateur | Succès : treasury | Échec |
|---|---|---|---|---|
| 10 | 50 KAS | 30 + 47,5 = 77,5 KAS | 2,5 KAS | 30 KAS au créateur, 5 KAS à chaque engagé |
| 20 | 100 KAS | 30 + 95 = 125 KAS | 5 KAS | 30 KAS au créateur, 5 KAS à chaque engagé |

Tous les calculs sont faits en sompis (1 KAS = 10^8 sompis), sans nombre à virgule.

## Gouvernance et abus (MVP)

Pas de contestation on-chain. Protection via la charte éthique, une documentation transparente et des signalements hors-chaîne.

Aucun remboursement à la demande : les flux dépendent uniquement du résultat on-chain (succès ou échec).
