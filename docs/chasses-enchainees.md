# Retrait et chasses enchaînées

Deux règles du registre, inspirées du six pager « Project Staghunt »
(hashdag) : on peut changer d'avis tant que rien n'est déclenché, et un
engagement peut dépendre d'une autre chasse.

## Retirer son engagement

Message `withdraw` : `{ "t": "withdraw", "hunt": "<id>" }`.

- Accepté tant que la chasse n'est **pas déclenchée** et que la date limite
  n'est pas passée. Une fois déclenchée, tout le groupe s'est engagé en même
  temps : plus de retrait (sinon l'assurance donnée aux autres ne vaut rien).
- Qui se retire : l'adresse qui envoie (wallet) ; en réserve, le code d'une
  preuve de pass (même scope que l'engagement, message
  `withdrawDigest(chasse)`) ; ou une place de pass de groupe (champ `place`
  et signature `sig` sur `placeWithdrawDigest(chasse)`).
- Après un retrait, on peut se réengager tant que la chasse est ouverte.
- Aucun nouvel état de chasse : le cycle reste « active, déclenchée,
  expirée » (AGENTS.md).

Sur le site : bouton « Retirer mon engagement » sur la page de la chasse
(mode registre, avec confirmation), `src/components/hunt/CommitExtras.tsx`.

## Engagement conditionnel (chasses enchaînées)

Champ facultatif `after` d'un engagement :
`{ "t": "commit", "hunt": "<B>", "after": "<A>" }` = « je m'engage dans B,
seulement si A s'est déclenchée ».

- `after` doit désigner une autre chasse déjà connue ; wallet seulement (une
  preuve de pass ne scelle pas la condition).
- Un engagement dont la condition n'est pas remplie ne compte pas dans le
  groupe retenu de B, et ne donne pas le rôle de participant.
- Quand A se déclenche, chaque chasse ouverte qui avait des engagements
  « après A » est réévaluée au même instant, et peut se déclencher à son
  tour (en chaîne). Une activation n'est jamais remise en cause : la règle
  reste monotone, le groupe retenu ne fait que grandir.
- Si A ne se déclenche jamais, l'engagement ne compte jamais.

Sur le site : dans la fenêtre d'engagement, case « Seulement si une autre
chasse se déclenche d'abord », puis choix de la chasse ; la page de la chasse
indique ensuite si la condition est remplie.

## Progression toujours masquée

Les nouvelles chasses ont toujours la progression masquée sur le site
(`progressVisibility: "hidden"`). Limite assumée : les engagements restent
publics sur la blockchain, et quelqu'un d'équipé peut les compter. Une vraie
opacité demanderait du chiffrement avancé (FHE à seuil), hors de portée pour
l'instant. Les anciennes chasses « visibles » restent affichées comme avant.

Code : `src/lib/onchain/ledger.ts`, tests dans `src/lib/onchain/ledger.test.ts`.
