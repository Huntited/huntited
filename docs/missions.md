# Missions

Le créateur d'une chasse lance des missions dans le salon ; chaque membre les
prouve ; la vérification se fait entre membres, chiffrée, sans rien publier
(`src/lib/missions.ts`, `src/components/hunt/MissionsBox.tsx`). Inspiré des
vérificateurs de Ta-da, sans jeton ni argent en jeu.

## Code de présence (sur place ou en ligne)

1. Le créateur ouvre une fenêtre de 10 minutes : son appareil tire un code de
   6 caractères et publie dans le salon son **empreinte**
   `sha256("huntited-mission|<id>|<code>")`.
2. Il montre le code : QR sur place (lien `#/hunt/<id>?code=…` qui pré-remplit
   le champ), ou il le dit/l'affiche en ligne.
3. Chaque membre saisit le code ; il est vérifié tout de suite contre
   l'empreinte. Sa preuve est `HMAC(code, "huntited-proof|<id>|<clé du membre>")` :
   elle montre qu'il connaissait le code sans le divulguer aux autres.
4. À la fin (ou plus tôt : « Clore maintenant »), le créateur révèle le code
   et la liste des preuves déjà reçues. Tout le monde vérifie : le code
   correspond à l'empreinte (sinon « le créateur a changé de code »), chaque
   preuve correspond, a été reçue avant la révélation, dans la fenêtre.

Limite : quelqu'un de présent peut donner le code à un absent pendant la
fenêtre.

## Vérification par 3 membres

Le membre décrit ce qu'il a fait. Trois autres membres sont tirés au sort de
façon vérifiable (tri par `sha256(<preuve>|<membre>)`) ; seuls leurs votes
comptent, la majorité décide. La fiabilité d'un vérificateur (votes conformes
à la décision) est calculée (`checkerRecord`).

## Ce qui en sort

- Dans le salon : ✓ à côté du pseudo des membres ayant validé une mission.
- Pas d'XP pour l'instant (non vérifiable hors du salon) ; jamais d'argent
  retenu : la règle du protocole garde les sanctions hors de la blockchain.

## Pistes

Lettre collective signée (preuve automatique), preuve zkTLS d'un retweet sans
révéler le compte, photo chiffrée comme preuve.
