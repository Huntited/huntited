# FAQ

## Que devient mon dépôt ?

Tes 5 KAS sont bloqués puis rendus à la fin, que l'action ait lieu ou non. En plus, tu reçois ta part de la récompense du créateur : 14,25 KAS à partager si l'action a lieu, 19 KAS si elle est annulée.

Le créateur bloque une caution de 30 KAS. Action réussie : 14,25 KAS aux engagés, 0,75 KAS à Huntited, il récupère 15 KAS. Action annulée : 19 KAS aux engagés, 1 KAS à Huntited, il récupère 10 KAS.

## Pourquoi au moins 7 personnes ?

Pour des actions vraiment collectives, et pour qu'un créateur ne puisse pas facilement récupérer sa propre récompense en s'engageant avec quelques wallets à lui.

## Puis-je fixer ma propre condition ?

Oui. En t'engageant, tu peux indiquer « je viens si au moins N personnes viennent » (au minimum le seuil de la chasse). Ta condition reste privée. La chasse se déclenche dès qu'un groupe se forme dans lequel la condition de chacun est remplie ; les engagements restent ouverts jusqu'à la date limite, donc le groupe peut encore grandir et t'inclure. Si ta condition n'est toujours pas remplie à la fin alors que la chasse a réussi, tu ne participes pas et tu récupères tes 5 KAS (sans part de la récompense).

## Pourquoi une récompense payée par le créateur ?

Pour que s'engager soit toujours une bonne décision : tu récupères ton dépôt dans tous les cas, plus une part de la récompense. Créer coûte 15 KAS si l'action réussit et 20 KAS si elle échoue : le créateur a intérêt à ne lancer que des chasses sérieuses, et à les faire réussir.

## Mon engagement est-il public ?

Non. Une empreinte anonyme représente l'engagement, jamais ton adresse.

Le nombre d'engagés, lui, est visible par défaut. Le créateur peut choisir de le masquer jusqu'à l'activation ou la date limite : s'engager en premier n'expose alors plus. Dans le prototype, ce masquage est un masquage d'affichage ; l'objectif du protocole ZK est de le rendre cryptographique, en prouvant que le seuil est atteint sans publier le nombre exact d'engagés ni leur identité.

## Une chasse peut-elle être contestée on-chain ?

Non, pas dans le MVP. Ce choix garde le protocole simple, lisible et plus facile à auditer. Les abus sont traités par la charte éthique, la réputation des créateurs et des canaux de signalement hors-chaîne.

Un veto des engagés pourra être étudié dans une version future si l'usage montre qu'il est nécessaire.

## Combien coûte un engagement ?

Rien : tes 5 KAS sont bloqués pendant la chasse puis rendus intégralement, et tu reçois une part de la récompense du créateur (voir « Que devient mon dépôt ? »).

## Puis-je m'engager plusieurs fois ?

Non : un wallet ne peut s'engager qu'une seule fois par chasse. L'adresse du wallet n'est jamais stockée, seulement une empreinte anonyme propre à chaque chasse.
