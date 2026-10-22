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

## Étapes suivantes

1. Messages par Bluetooth entre apps (pont page ↔ mesh, `window.HuntitedApp`).
2. Renvoi aux relais Nostr des messages échangés hors ligne, quand le réseau revient.
