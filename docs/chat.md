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

## Plan B sans réseau (bitchat)

Un site web ne peut pas relayer de messages par Bluetooth ou Wi-Fi direct.
Le chat propose donc un « Plan B » : installer l'application
[bitchat](https://github.com/permissionlesstech/bitchat) (mesh Bluetooth,
domaine public pour iOS/macOS) avant le jour J, et partager son pseudo
bitchat dans le chat chiffré (champ `bitchat` du message, comme le pseudo).
Les membres peuvent alors s'écrire en privé dans bitchat si internet coupe.
Le canal `#bluetooth` de bitchat est public : rien de sensible.

Plus tard : une application Huntited pour téléphone reprenant le transport
Bluetooth de bitchat et ajoutant notre chat (mêmes clés, mêmes membres, même
format Nostr). Licence Android à vérifier (GPL-3.0 annoncée).

## Messages vocaux et talkie-walkie

- Vocal : bouton micro à côté d'« Envoyer » (30 s au plus, Opus ~12 kbit/s,
  environ 45 Ko). Le son est dans le message chiffré (`audio: { mime, data,
  ms }`), comme le texte : relais et Bluetooth ne voient rien. Relu par une
  adresse `data:` (CSP `media-src`).
- Talkie-walkie (app Huntited Chat) : « Écouter », puis maintenir le bouton
  pour parler (15 s au plus). Le message part au relâchement (`ptt: true`),
  par Bluetooth et par les relais ; il se joue tout de suite chez les membres
  à l'écoute, salon ouvert et écran allumé. Ce n'est pas un flux continu :
  le son arrive après la fin de la prise de parole.
- Le micro n'est accordé qu'au site livré avec l'app (WebView), et seulement
  le micro.

## Effacement

- Fermeture : 24 h après la date limite, chaque message expire chez les
  relais qui respectent NIP-40 (copies restantes : chiffrées).
- Messages éphémères : le créateur choisit 1 h, 6 h ou 24 h (`room: { ttl }`
  dans un message chiffré). Chaque message porte alors sa date de fin
  (`exp`, et l'étiquette `expiration` pour les relais) et disparaît de
  l'écran des membres à cette heure. La clé de présence et les réglages
  restent jusqu'à la fermeture.
- « Oublier ce salon sur cet appareil » : efface la clé et le pseudo de ce
  salon, arrête le compteur de présence.
- App Huntited Chat : « Effacer les salons » (accueil) et l'effacement
  d'urgence de bitchat (3 appuis sur le logo du chat) effacent le stockage du
  site (clés, pseudos), les chasses suivies et les messages reçus par
  Bluetooth (`huntited/HuntitedWipe.kt`).
- Limite : une capture d'écran par un membre reste possible ; un relais qui
  ignore l'expiration garde une copie chiffrée.
