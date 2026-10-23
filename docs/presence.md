# Compteur de présence (jour J)

Dans l'app Huntited Chat, le salon d'une chasse affiche combien de membres de
la chasse sont autour de soi, par Bluetooth, sans dire qui. Le créateur peut
fixer un **seuil sur place** (« on y va quand on est 50 ») : quand il est
atteint, chaque membre présent est prévenu, même écran éteint.

## Clé commune

- La clé de présence (32 octets au hasard) voyage dans le salon, dans un
  message chiffré pour les membres seuls et non affiché
  (`presence: { key, onsite? }`, `src/lib/p2p-chat.ts`).
- Clé en vigueur (`presenceState`, `src/lib/presence.ts`) : le dernier message
  du créateur s'il en a envoyé un, sinon le plus ancien. Tous les membres
  retombent sur la même.
- Pas encore de clé 15 s après l'ouverture du salon : le membre en crée une.
- Membres arrivés après : l'auteur du message en vigueur leur renvoie la clé.
- Le seuil sur place est fixé par le créateur (message visible dans le salon).

## Signal « je suis là » (app, `huntited/HuntitedPresence.kt`)

- Toutes les 45 s, par le mesh Bluetooth (paquet `HUNTITED_EVENT`) :
  `{"p":1, "h": HMAC(clé, "huntited-presence-topic|<heure>"), "c": AES-GCM(clé, "<id>|<date>")}`.
- L'étiquette change chaque heure et ne nomme pas la chasse ; le contenu
  change à chaque envoi (nonce neuf). Un inconnu ne peut ni le lire, ni
  suivre quelqu'un.
- Identifiant de présence d'un membre : HMAC(clé, clé privée de chat) ; stable
  pour la chasse, sans lien visible avec sa clé publique. Un membre compte une
  fois ; les autres membres ne savent pas qui il est.
- Compte : identifiants distincts vus ces 3 dernières minutes, plus soi.
  Signaux de plus de 5 min ignorés.
- Les chasses suivies sont gardées (jusqu'à 24 h après la date limite) et le
  service du mesh garde l'app en vie écran éteint.

## Limites

- Compte approximatif : portée Bluetooth de 10 à 50 m par téléphone, signaux
  relayés jusqu'à 7 sauts.
- Un membre qui modifie l'app peut gonfler le compte (faux identifiants) :
  l'empêcher sans révéler qui est présent demanderait des signatures de
  cercle. Le compte rassure et coordonne ; il ne prouve rien.
- Test : deux vrais téléphones Android au moins (l'émulateur n'a pas de
  Bluetooth).
