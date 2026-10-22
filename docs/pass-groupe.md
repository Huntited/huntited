# Pass d'organisation (syndicats, associations, collectifs)

Page `#/group`. L'organisation crée ses adhérents une fois : chacun reçoit un
**lien personnel permanent** (`#/member/<boîte>/<secret>`). Pour chaque chasse,
elle colle le lien de la chasse et l'**ouvre à ses adhérents** : la place de
chaque adhérent est une clé **dérivée de son secret et de la chasse**
(`memberPlaceKey`, HKDF), donc ses engagements ne peuvent pas être reliés
d'une chasse à l'autre sur la blockchain. L'organisation inscrit les places de
tous ses adhérents (message `places`, 100 par transaction), puis les
engagements reçus par lots (`gcommit`), exactement comme ci-dessous.
L'adhérent ouvre toujours le même lien : il y voit les chasses que son
organisation lui a ouvertes (`getChainMemberHunts`) et s'engage sans wallet.

Code : `src/lib/org-pass.ts`, `src/routes/group.tsx`,
`src/routes/member.$inbox.$secret.tsx`.

# Pass de groupe (mécanisme commun)

Pour une association ou un collectif : offrir des places à ses membres, qui
s'engagent **sans wallet ni KAS**. Sur la blockchain, c'est l'association qui
inscrit les engagements : on ne voit jamais le wallet ni le nom du membre.

## Déroulé

1. **L'association crée N places** pour une chasse ouverte (page `#/group`,
   lien « Une association ? Offre des places » sur la page d'une chasse).
   Les clés restent dans son navigateur ; elle télécharge la sauvegarde.
2. **Elle inscrit les places** : message `places` (100 clés au plus par
   transaction, 0,2 KAS de test).
3. **Elle envoie un lien par membre** : `#/place/<chasse>/<clé de place>/<boîte>`.
   Le lien est un billet : qui l'a peut utiliser la place.
4. **Le membre ouvre le lien et s'engage** : son navigateur signe l'engagement
   avec la clé de place (chasse, seuil personnel, clé de chat) et l'envoie,
   chiffré pour la boîte de l'association, aux relais Nostr (type `4243`).
5. **L'association inscrit les engagements reçus par lots** : message
   `gcommit` (40 au plus par transaction, 0,2 KAS). Le registre vérifie la
   signature de chaque place ; une place ne sert qu'une fois ; une entrée
   invalide est ignorée seule. Le membre voit « inscrit ✓ » et entre dans le
   chat chiffré de la chasse.

## Messages (`src/lib/onchain/protocol.ts`, identique côté serveur)

- `{"t":"places","hunt":"<id>","keys":["<clé publique x>", …]}` : chasse
  existante et ouverte ; une clé déjà inscrite est ignorée.
- `{"t":"gcommit","hunt":"<id>","entries":[{"place","threshold?","chat?","sig"}]}` :
  `sig` = Schnorr de la place sur
  `sha256("huntited:place-commit|<chasse>|<seuil>|<clé de chat>")`.
  N'importe qui peut envoyer un lot (utile si l'association perd son wallet).

## Limites

- L'association doit inscrire les lots **avant la date limite** ; le compteur
  ne bouge qu'à ce moment-là.
- Elle peut gonfler le compteur avec ses propres places : elle les paie, comme
  on peut le faire avec plusieurs wallets.
- Quand les dépôts deviendront réels, l'association paiera aussi le dépôt de
  chaque place.

Essai réel (réseau de test, octobre 2026) : 7 places, 6 membres simulés et un
membre dans le navigateur ; demandes reçues et vérifiées par l'association,
lot inscrit, chasse déclenchée, membre « inscrit ✓ » et dans le chat.
