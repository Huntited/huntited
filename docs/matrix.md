# Chat Matrix (Synapse + Element)

## Comment ça marche

1. La chasse se déclenche : **le backend crée aussitôt, sans aucun clic**, un
   salon sur le serveur Matrix de Huntited — **privé, non fédéré, chiffré de
   bout en bout**, historique visible seulement depuis l'arrivée de chacun.
   Si Matrix est indisponible à ce moment-là, le salon est créé à la première
   visite d'une personne autorisée sur la page de la chasse (nom et
   expiration toujours tirés du registre, jamais du navigateur).
2. Chaque personne autorisée (créateur, engagé·es retenu·es) qui ouvre le
   chat reçoit **un compte temporaire propre à cette chasse** : identifiant
   aléatoire (`@h…:huntited.org`), pseudonyme « Participant·e N », mot de
   passe temporaire. Le backend l'ajoute au salon.
3. La personne ouvre Element (bouton « Ouvrir le chat Matrix ») et se
   connecte avec ces identifiants. Element assure le chiffrement de bout en
   bout.
4. 24 h après la date limite : salon supprimé (membres expulsés, historique
   purgé), comptes temporaires désactivés et effacés.

**Vie privée** : Matrix ne reçoit jamais le wallet ; le lien entre une
personne et son compte temporaire n'existe que dans la mémoire du backend
(empreinte propre à la chasse), le temps du salon. Les identifiants ne sont
pas enregistrés sur l'appareil.

**Redémarrages** : le lien chasse → salon (et les comptes temporaires) est
gardé dans `CHAT_FILE` (`data/chats.json`, hors git), pour que les salons
ouverts soient toujours fermés à leur expiration. Obligatoire en mode synapse.

## Installation (une machine avec Docker)

Fichiers prêts dans `deploy/matrix/`.

1. **DNS** : deux sous-domaines vers la machine, ex. `matrix.huntited.org`
   (Synapse) et `chat.huntited.org` (Element). Adapter `Caddyfile`,
   `element-config.json` et `homeserver.extra.yaml`.
2. **Configuration Synapse** :
   ```bash
   docker run -it --rm -v ./synapse:/data -e SYNAPSE_SERVER_NAME=huntited.org -e SYNAPSE_REPORT_STATS=no matrixdotorg/synapse:latest generate
   ```
   puis ajouter le contenu de `homeserver.extra.yaml` à la fin de
   `synapse/homeserver.yaml`.
3. **Démarrer** : `docker compose up -d`.
4. **Compte « bot » administrateur** (utilisé seulement par le backend) :
   ```bash
   docker compose exec synapse register_new_matrix_user -c /data/homeserver.yaml -u huntited-bot -a http://localhost:8008
   ```
   puis récupérer son jeton d'accès (connexion `m.login.password` sur
   `/_matrix/client/v3/login`). **Ce jeton est un secret** : il va
   uniquement dans la configuration du backend.
5. **Restreindre l'API d'administration** au backend : remplacer
   `IP_DU_BACKEND` dans `Caddyfile`.
6. **Backend** (`backend/.env`) :
   ```env
   MATRIX_MODE=synapse
   MATRIX_HOMESERVER_URL=https://matrix.huntited.org
   MATRIX_SERVER_NAME=huntited.org
   MATRIX_CLIENT_URL=https://chat.huntited.org
   MATRIX_ACCESS_TOKEN=<jeton du bot, jamais dans une variable VITE_>
   CHAT_FILE=data/chats.json
   ```

## Tests

- `backend/src/services/matrix-synapse.test.ts` : salon non fédéré et
  chiffré, un compte temporaire par personne (réutilisé au retour, nouveau
  mot de passe), suppression du salon et effacement des comptes, erreurs
  sans token ni identifiant.
- Sans serveur Synapse (développement, E2E) : `MATRIX_MODE=mock`, chat
  simulé (mention « Démonstration » dans le panneau).
