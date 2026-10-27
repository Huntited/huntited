# Huntited Chat (app Android)

Code source : https://codeberg.org/Huntited/huntited-chat (GPL-3.0, version
modifiée de bitchat-android). Installation : https://huntited.com/app/.

## Salon d'une chasse dans l'app

- L'app embarque la version statique du site (`npm run build:static`, copiée
  par `tools/sync-site.ps1` dans `app/src/main/assets/site`), servie à
  `https://appassets.androidplatform.net/site/` (contexte sécurisé). C'est le
  même code que huntited.com : membres lus sur Kaspa, chat chiffré par Nostr.
- Sur le site, le chat d'une chasse propose « Ouvrir dans l'app Huntited Chat » :
  - Android : lien `intent://salon/<chasse>/<clé>#Intent;scheme=huntited;…` ;
  - ailleurs : QR code / lien `https://huntited.com/app/salon#<chasse>.<clé>`
    (la clé reste après `#`, jamais envoyée au serveur) ;
  - `src/lib/app-link.ts`.
- L'app ouvre `#/room/<chasse>/<clé>` : la clé est enregistrée, puis la chasse
  s'affiche (`src/routes/room.$hunt.$key.tsx`).
- Lien d'application vérifié : `public/.well-known/assetlinks.json` (empreinte
  SHA-256 du certificat de signature de l'app).
- Pages de secours : `/app/` (installer) et `/app/salon` (ouvrir l'app depuis
  un navigateur).

## Clé de signature

Fichier `C:\Users\timot\Android\keys\huntited-chat-release.jks` et son mot de
passe (`keystore.properties`), hors de tout dépôt. **À sauvegarder** : sans
elle, impossible de publier une mise à jour de l'app sous le même nom, et le
lien huntited.com → app cesse de fonctionner.

## Messages par Bluetooth (sans internet)

Dans l'app, les messages du salon (kind 4242) et les demandes de place
(kind 4243) passent aussi par le mesh Bluetooth de bitchat, de téléphone en
téléphone (jusqu'à 7 sauts) :

- Le site (`src/lib/mesh-bridge.ts`) envoie chaque événement Nostr signé aux
  relais **et** à l'app (`HuntitedApp.meshSend`) ; l'app remet ceux du mesh
  à la page (`window.__huntitedMesh`). Signature vérifiée, doublons écartés.
- Confidentialité : un message de salon part sur le Bluetooth dans une
  enveloppe chiffrée en entier avec la clé commune des membres (dérivée de la
  clé de présence) : ni auteur ni salon visibles, étiquette qui change chaque
  heure. Sans cette clé, le message passe seulement par internet.
- Côté app, un type de paquet à part (`HUNTITED_EVENT`, 0x48 ;
  `huntited/HuntitedMesh.kt`) : n'apparaît jamais dans le chat bitchat, et
  les apps bitchat ordinaires ne le relaient pas. Le contenu reste chiffré.
- Stocker puis transmettre : l'app garde les 500 derniers événements reçus
  (7 jours max.) ; à l'ouverture du salon, la page les relit, puis les renvoie
  aux relais, qui les publient dès qu'internet revient.
- Le Bluetooth démarre si les autorisations ont été données (ouvrir une fois
  l'app depuis son icône). Le salon l'indique.
- Test : il faut deux vrais téléphones Android (l'émulateur n'a pas de
  Bluetooth). Couper le Wi-Fi et les données sur les deux, écrire dans le
  salon d'une même chasse.

## Étapes suivantes

1. Renvoyer les messages gardés aux téléphones qui arrivent à portée plus tard
   (aujourd'hui : seulement ceux à portée au moment de l'envoi).
2. Version iOS (même principe, fork de bitchat iOS).
