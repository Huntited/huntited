# Modération

La blockchain ne permet pas de supprimer une chasse. Huntited peut seulement
**la masquer sur le site**, de façon publique et réversible.

- **Qui** : uniquement la clé de publication (celle qui possède huntited.kas,
  `releaseAddresses` du registre, comme pour les versions officielles).
- **Comment** : page `#/publish` (« Versions et modération »), section
  « Modération » : lien ou identifiant de la chasse, raison, puis Kastle envoie
  le message au registre (0,2 KAS de test).
- **Messages** (`src/lib/onchain/protocol.ts`, identique côté serveur) :
  - `{"t":"hide","hunt":"<id>","reason":"illegal|violence|harassment|personal-data|deception|spam"}`
  - `{"t":"unhide","hunt":"<id>"}`
    Envoyés par une autre adresse : ignorés (`not_publisher`).
- **Effet** : la chasse disparaît des listes ; sa page indique « Chasse
  masquée » avec la raison et un lien vers les usages interdits. Côté serveur,
  `/api/chain/hunts` l'omet et `/api/chain/hunts/:id` répond 410.
- **Transparence** : la liste des chasses masquées (identifiant, raison, date)
  est affichée à tous sur la même page. Chaque décision est une transaction
  publique ; n'importe qui peut la vérifier.

Une copie du site qui ignorerait ces messages afficherait toujours la chasse :
c'est le prix d'un registre sans administrateur. La vérification des versions
(`npm run verify:release`) permet de savoir si un site est la version
officielle.
