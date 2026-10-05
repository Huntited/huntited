# FAQ

## Que devient mon dépôt ?

Le dépôt de création de 30 KAS est remboursé au créateur si le seuil est atteint. Sinon, il verse d'abord 1 KAS de bonus à chaque engagé (30 KAS au plus, partagés au-delà de 30 engagés) et le créateur récupère le reste.

Un engagement coûte 5 KAS. Si le seuil n'est pas atteint avant la deadline, le dépôt est remboursé intégralement, avec un bonus pouvant aller jusqu'à 1 KAS pris sur le dépôt du créateur. Si le seuil est atteint, le dépôt finance le créateur à 95 % et la treasury à 5 %. Dans ce cas, les engagé·es ne récupèrent pas leur dépôt.

## Pourquoi un bonus si la chasse échoue ?

Pour que s'engager soit toujours une bonne décision : si l'action se fait, tu y participes ; si elle ne se fait pas, tu récupères ton dépôt et un petit bonus. Le bonus est payé par le créateur, ce qui l'incite à ne lancer que des chasses sérieuses.

## Mon engagement est-il public ?

Non. Une empreinte anonyme représente l'engagement, jamais ton adresse.

Le nombre d'engagés, lui, est visible par défaut. Le créateur peut choisir de le masquer jusqu'à l'activation ou la date limite : s'engager en premier n'expose alors plus. Dans le prototype, ce masquage est un masquage d'affichage ; l'objectif du protocole ZK est de le rendre cryptographique, en prouvant que le seuil est atteint sans publier le nombre exact d'engagés ni leur identité.

## Une chasse peut-elle être contestée on-chain ?

Non, pas dans le MVP. Ce choix garde le protocole simple, lisible et plus facile à auditer. Les abus sont traités par la charte éthique, la réputation des créateurs et des canaux de signalement hors-chaîne.

Un veto des engagés pourra être étudié dans une version future si l'usage montre qu'il est nécessaire.

## Combien coûte un engagement ?

Un engagement coûte 5 KAS. Si le seuil n'est pas atteint avant la deadline, le dépôt est remboursé intégralement, avec un bonus pouvant aller jusqu'à 1 KAS pris sur le dépôt du créateur. Si le seuil est atteint, le dépôt finance le créateur à 95 % et la treasury à 5 %.

## Puis-je m'engager plusieurs fois ?

Non : un wallet ne peut s'engager qu'une seule fois par chasse. L'adresse du wallet n'est jamais stockée, seulement une empreinte anonyme propre à chaque chasse.
