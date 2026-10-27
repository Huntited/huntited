# Prouver un retweet, un commentaire ou un like (étude zkTLS)

But : un membre prouve à son salon qu'il a retweeté, commenté ou liké un post
X, **sans révéler son compte X**. Rien n'est encore construit ; cette page
décrit ce qui est faisable et dans quel ordre.

## Le principe

Le zkTLS (TLSNotary, Reclaim, zkPass) produit une preuve qu'une réponse est
bien venue de x.com, en ne dévoilant que quelques champs choisis. Le membre
ouvre x.com connecté à son compte ; la preuve dit par exemple « pour le
compte connecté, le post 123 est liké », sans dire quel compte.

## Les trois actions

| Action      | Faisable ?     | Comment                                                                                                                                                                                                         |
| ----------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Like        | Oui            | La page du post renvoie, pour le compte connecté, `favorited: true`. On ne dévoile que ce champ et l'identifiant du post. Les likes sont privés sur X depuis juin 2024 : seul l'auteur du post voit qui a liké. |
| Retweet     | Oui            | Même réponse, champ `retweeted: true`. Une seule preuve couvre like et retweet.                                                                                                                                 |
| Commentaire | Plus difficile | Il faut prouver qu'une réponse au post existe **et** qu'elle vient du compte connecté, sans dévoiler ce compte : cela demande de comparer deux valeurs cachées dans la preuve (travail en plus).                |

Variante simple pour le commentaire : le commentaire contient un mot convenu
par le salon. Mais le commentaire est public : quiconque voit ce mot sous le
post peut deviner que ce compte fait partie du groupe. À réserver aux missions
où ce lien n'est pas gênant.

## Empêcher la triche

- **Un compte X pour plusieurs membres** : la preuve doit dévoiler une
  empreinte `sha256(mission | identifiant X)`, la même à chaque fois pour un
  même compte ; deux preuves avec la même empreinte = un seul compte. Limite :
  quelqu'un qui soupçonne un compte précis peut recalculer l'empreinte et
  vérifier.
- **Annuler juste après** (unlike) : la preuve dit « liké à ce moment-là ».
  On peut demander une seconde preuve plus tard, si besoin.

## Les outils

| Outil     | Pour                                                                                                      | Contre                                                                               |
| --------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| TLSNotary | Libre, sans jeton, serveur de vérification hébergeable par Huntited ; extension et exemple X.com fournis. | Extension pour navigateurs Chromium sur ordinateur ; pas de version mobile annoncée. |
| Reclaim   | Fonctionne sur téléphone ; fournisseurs X existants (profil).                                             | Réseau de vérificateurs tiers ; pas de fournisseur « like/retweet » confirmé.        |
| zkPass    | Extension TransGate.                                                                                      | Peu de documentation publique récente ; rien de confirmé pour X.                     |

## Risques communs

- La preuve lit l'API interne de x.com : elle peut casser à chaque changement
  de X, sans prévenir.
- Les conditions d'utilisation de X encadrent l'automatisation ; la preuve est
  faite par le membre lui-même, depuis sa session, ce qui limite ce risque.
- Le serveur de vérification voit qu'une preuve x.com est faite (pas son
  contenu caché).

## Proposition

1. **Like + retweet avec TLSNotary**, sur ordinateur, serveur de vérification
   tenu par Huntited ; la preuve est déposée dans le salon comme les autres
   preuves de mission (`kind: "x"`), vérifiée par chaque membre.
2. **Commentaire** ensuite : d'abord la variante « mot convenu » (avec
   l'avertissement), puis la version sans lien visible.
3. **Téléphone** : suivre l'arrivée de TLSNotary sur mobile, ou utiliser
   Reclaim si un fournisseur adapté existe.

En attendant, la vérification par 3 membres (capture d'écran décrite) reste
la solution pour ces missions.
