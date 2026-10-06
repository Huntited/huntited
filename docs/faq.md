# FAQ

## Que devient mon dépôt ?

Tes 5 KAS sont bloqués puis rendus à la fin, que l'action ait lieu ou non. Si elle a lieu, tu reçois en plus une récompense du créateur : jusqu'à 1 KAS pour 30 KAS de caution (le créateur peut mettre plus).

Le créateur bloque une caution de 30 KAS au moins et n'y gagne jamais rien : on lui en rend une partie. Avec 30 KAS : action réussie, jusqu'à 1 KAS par engagé (14,25 KAS au plus) et 0,75 KAS à Huntited, le reste lui est rendu ; action annulée, 1 KAS à Huntited et 29 KAS lui sont rendus. Tout est proportionnel à la caution.

## Pourquoi au moins 7 personnes ?

Pour des actions vraiment collectives, et pour qu'un créateur ne puisse pas facilement récupérer sa propre récompense en s'engageant avec quelques wallets à lui.

## Puis-je fixer ma propre condition ?

Oui. En t'engageant, tu peux indiquer « je viens si au moins N personnes viennent » (au minimum le seuil de la chasse). Ta condition reste privée. La chasse se déclenche dès qu'un groupe se forme dans lequel la condition de chacun est remplie ; les engagements restent ouverts jusqu'à la date limite, donc le groupe peut encore grandir et t'inclure. Si ta condition n'est toujours pas remplie à la fin alors que la chasse a réussi, tu ne participes pas et tu récupères tes 5 KAS (sans récompense).

## Pourquoi une récompense payée par le créateur ?

Pour que s'engager soit toujours une bonne décision : tu récupères ton dépôt dans tous les cas, et tu es récompensé si l'action a lieu. Il n'y a pas de récompense en cas d'échec : engager des bots sur une chasse vouée à l'échec ne rapporte rien. Et la récompense est plafonnée à 1 KAS par engagé : un créateur ne gagne presque rien à s'engager avec ses propres wallets.

## Mon engagement est-il public ?

Non. Une empreinte anonyme représente l'engagement, jamais ton adresse.

Le nombre d'engagés, lui, est visible par défaut. Le créateur peut choisir de le masquer jusqu'à l'activation ou la date limite : s'engager en premier n'expose alors plus. Dans le prototype, ce masquage est un masquage d'affichage ; l'objectif du protocole ZK est de le rendre cryptographique, en prouvant que le seuil est atteint sans publier le nombre exact d'engagés ni leur identité.

## Une chasse peut-elle être contestée on-chain ?

Non, pas dans le MVP. Ce choix garde le protocole simple, lisible et plus facile à auditer. Les abus sont traités par la charte éthique, la réputation des créateurs et des canaux de signalement hors-chaîne.

Un veto des engagés pourra être étudié dans une version future si l'usage montre qu'il est nécessaire.

## Combien coûte un engagement ?

Rien : tes 5 KAS sont bloqués pendant la chasse puis rendus intégralement. Si l'action a lieu, tu reçois en plus jusqu'à 1 KAS (voir « Que devient mon dépôt ? »).

## Puis-je m'engager plusieurs fois ?

Non : un wallet ne peut s'engager qu'une seule fois par chasse. L'adresse du wallet n'est jamais stockée, seulement une empreinte anonyme propre à chaque chasse.
