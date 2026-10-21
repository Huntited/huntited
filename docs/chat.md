# Chat chiffré des chasses (sans serveur)

Pour une chasse inscrite sur la blockchain (mode `chain`, version statique),
le chat ne passe par aucun serveur Huntited.

## Qui peut lire et écrire

- À la création d'une chasse ou à l'engagement, le navigateur crée une **clé de
  chat** pour cette chasse (secp256k1, `src/lib/p2p-chat.ts`), gardée dans
  `localStorage` (`huntited:chat-keys`, visible dans « Tes données »).
- Sa partie publique est inscrite sur la chaîne dans le message (`chat` dans
  `hunt` et `commit`, `src/lib/onchain/protocol.ts`).
- **Membres** = clés du créateur et des engagements, lues sur la chaîne, une
  fois la chasse déclenchée (`getChainChat`). Personne ne peut s'ajouter.

## Messages

- Chiffrés une fois (AES-GCM, clé aléatoire) ; cette clé est chiffrée pour
  chaque membre avec un secret partagé ECDH (x seul) + HKDF, propre à la
  chasse. Pas d'échange préalable entre membres.
- Envoyés comme événements **Nostr** (type `4242`, étiquette `h` = empreinte
  de l'identifiant de chasse), signés par la clé de chat de l'auteur. Un
  événement d'une clé non membre, mal signé ou modifié est ignoré.
- **Pseudo** : un par chasse, au hasard au départ (« Renard bleu »), modifiable ;
  envoyé dans la partie chiffrée du message, jamais sur la chaîne. Affiché avec
  une marque fixe tirée de la clé (`#4F2A`) : un pseudo ne peut pas en imiter
  un autre ; le rôle « Créateur·rice » vient de la chaîne.
- Étiquette `expiration` (NIP-40) : 24 h après la date limite.
- **Notifications** (`src/lib/chat-notify.ts`, `ChatWatcher`) : bouton « Me
  prévenir » par chasse ; tant qu'une page Huntited est ouverte, un nouveau
  message d'un autre membre affiche une notification du navigateur, sans le
  texte du message. Sans serveur, rien quand le site est fermé.
- Relais : `VITE_NOSTR_RELAYS` (par défaut relay.damus.io, nos.lol,
  relay.primal.net). Envoi à tous, lecture sur tous, doublons écartés
  (`src/lib/nostr-relays.ts`).

## Limites

- **Clé liée à l'appareil** : sur un autre navigateur, ou après effacement des
  données, le chat de cette chasse n'est plus lisible.
- **Métadonnées** : les relais voient l'adresse IP, l'heure, la taille et la clé
  de chat de l'auteur (liée à son engagement sur la chaîne), pas le contenu.
- **Effacement** : l'expiration est une demande ; un relais peut garder les
  messages (toujours chiffrés).
- Une clé invalide inscrite sur la chaîne est ignorée (ce membre ne lit pas).
