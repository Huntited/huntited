# iPhone et iPad, sans App Store

- **App web installable** : dans Safari, Partager → « Sur l'écran
  d'accueil ». Huntited s'ouvre alors en plein écran comme une app
  (`public/manifest.json`, icônes, balises Apple dans
  `static/index.html`). Un bandeau l'explique une fois sur iPhone
  (`IosInstallHint`).
- Marche : chasses, wallet intégré (code), salons chiffrés, vocaux,
  notifications (iOS 16.4+, une fois installé).
- Ne marche pas sur iPhone : le Bluetooth (mesh, compteur de présence,
  talkie-walkie hors ligne) — Safari n'y a pas accès — et l'empreinte pour le
  wallet (prévu : clé d'accès / Face ID par WebAuthn).
- App iOS native plus tard : dans l'Union européenne, distribution hors App
  Store possible (AltStore PAL, ou téléchargement depuis le site), mais il
  faut un compte développeur Apple (99 $/an) et la « notarisation » d'Apple ;
  ailleurs, App Store ou TestFlight seulement.
