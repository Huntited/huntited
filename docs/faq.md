# FAQ

## Que devient mon dépôt ?

Le créateur bloque une caution de 30 KAS, partagée avec les engagés. Si l'action a lieu, 95 % de la caution (28,5 KAS) est partagée entre les engagés et 5 % va à Huntited. Sinon, 47,5 % (14,25 KAS) est partagée entre les engagés, 2,5 % va à Huntited et le créateur récupère la moitié.

S'engager coûte 5 KAS. Si l'action a lieu, tes 5 KAS vont au créateur (95 %) et à Huntited (5 %), et tu reçois ta part des 28,5 KAS de la caution du créateur. Si elle n'a pas lieu (pas assez de monde à la date limite), tu récupères tes 5 KAS, plus ta part des 14,25 KAS de la caution.

## Pourquoi au moins 7 personnes ?

En cas de succès, le créateur laisse sa caution aux engagés et reçoit 95 % de leurs engagements. En dessous de 7 personnes, il perdrait de l'argent alors que son action a réussi.

## Puis-je fixer ma propre condition ?

Oui. En t'engageant, tu peux indiquer « je viens si au moins N personnes viennent » (au minimum le seuil de la chasse). Ta condition reste privée. La chasse se déclenche dès qu'un groupe se forme dans lequel la condition de chacun est remplie ; les engagements restent ouverts jusqu'à la date limite, donc le groupe peut encore grandir et t'inclure. Si ta condition n'est toujours pas remplie à la fin alors que la chasse a réussi, tu ne participes pas et tu récupères tes 5 KAS (sans part de la caution).

## Pourquoi partager la caution du créateur ?

Pour que s'engager soit toujours une bonne décision : si l'action se fait, tu y participes et tu reçois une part de la caution ; si elle ne se fait pas, tu récupères ton dépôt et une part de la caution. Un échec coûte la moitié de sa caution au créateur, ce qui l'incite à ne lancer que des chasses sérieuses.

## Mon engagement est-il public ?

Non. Une empreinte anonyme représente l'engagement, jamais ton adresse.

Le nombre d'engagés, lui, est visible par défaut. Le créateur peut choisir de le masquer jusqu'à l'activation ou la date limite : s'engager en premier n'expose alors plus. Dans le prototype, ce masquage est un masquage d'affichage ; l'objectif du protocole ZK est de le rendre cryptographique, en prouvant que le seuil est atteint sans publier le nombre exact d'engagés ni leur identité.

## Une chasse peut-elle être contestée on-chain ?

Non, pas dans le MVP. Ce choix garde le protocole simple, lisible et plus facile à auditer. Les abus sont traités par la charte éthique, la réputation des créateurs et des canaux de signalement hors-chaîne.

Un veto des engagés pourra être étudié dans une version future si l'usage montre qu'il est nécessaire.

## Combien coûte un engagement ?

5 KAS, rendus intégralement si l'action n'a pas lieu. Dans tous les cas, tu reçois une part de la caution du créateur (voir « Que devient mon dépôt ? »).

## Puis-je m'engager plusieurs fois ?

Non : un wallet ne peut s'engager qu'une seule fois par chasse. L'adresse du wallet n'est jamais stockée, seulement une empreinte anonyme propre à chaque chasse.
