# Wallet intégré

Un wallet Kaspa rangé dans le navigateur, sans extension : il marche sur
ordinateur, sur téléphone et dans l'app Huntited Chat. Page « Mon wallet »
(`/wallet`, `src/routes/wallet.tsx`).

## Clé et phrase

- Phrase de récupération de 12 mots (BIP39, liste anglaise, `@scure/bip39`).
- Clé : chemin de Kaspa `m/44'/111111'/0'/0/0` (`@scure/bip32`), comme
  Kastle et Kaspium : la même phrase y retrouve le même compte (vérifié
  contre le SDK officiel, test `builtin-wallet.test.ts`).
- Adresse Schnorr (version 0), encodage cashaddr de Kaspa
  (`src/lib/kaspa/address.ts`).
- La phrase est dans le stockage du navigateur (`huntited:builtin-wallet`,
  groupe « wallet » de « Tes données », affiché comme secret). Effacer les
  données du site ou « Effacer les salons » dans l'app retire aussi le wallet.

## Protection

Au choix, sur la page « Mon wallet » (`protectBuiltin`) :

- **Code** : chiffres (6 ou plus) ou mot de passe (8 ou plus). La phrase est
  chiffrée en AES-GCM avec une clé tirée du code (PBKDF2-SHA256, 600 000
  tours). Après 5 codes faux, attente de 30 s doublée à chaque erreur
  (1 h au plus). Option : effacer le wallet après 10 codes faux.
- **Empreinte ou visage** (app Huntited Chat, Android 11+,
  `huntited/HuntitedBio.kt`) : l'app chiffre avec une clé AES gardée par
  la puce sécurisée (Android Keystore), utilisable seulement juste après une
  empreinte ou un visage reconnus. Ajouter une empreinte au téléphone
  invalide la clé : il faut alors la phrase de 12 mots. L'effacement
  d'urgence supprime la clé.
- **Les deux** : chiffré par le code, puis par l'empreinte.
- **Reverrouillage** : à chaque opération, après 5 ou 30 minutes, ou à la
  fermeture de la page. L'adresse et le solde restent visibles verrouillé.
- Une opération qui a besoin de la clé (engagement, phrase, changement de
  protection) ouvre la fenêtre de déverrouillage (`WalletUnlock`).

## Envoi

- `src/lib/kaspa/tx.ts` : choix des UTXO, monnaie, masse (calcul, transitoire,
  stockage KIP-9), frais (≥ 100 sompi par gramme de masse de calcul, minimum
  des nœuds), hachage de signature SigHashAll et signature Schnorr.
- `src/lib/kaspa/node.ts` : un resolver public (`*.kaspa.stream`) donne un
  nœud, joint en wRPC JSON par WebSocket (`getUtxosByAddresses`,
  `submitTransaction`). L'API REST n'est pas utilisée pour l'envoi : elle
  perd le message (payload) des transactions.
- CSP du site : `connect-src` autorise ces resolvers et nœuds
  (`scripts/build-static.mjs`).
- Vérifié en réel sur le réseau de test : transaction signée dans le
  navigateur et acceptée (engagement inscrit au registre).

## Choix du wallet

`connectWallet()` (`src/lib/wallet.ts`) : le wallet intégré s'il existe, sinon
l'extension Kastle, sinon la page « Mon wallet » pour en créer un.

## Obtenir des KAS

- Réseau de test : bouton « Recevoir des KAS de test gratuits » (adresse
  copiée, distributeur du réseau de test ouvert).
- Réseau principal : bouton « Acheter des KAS en euros » vers le service
  d'achat de `VITE_ONRAMP_URL` (adresse copiée, à coller). Les widgets
  pré-remplis demandent un compte partenaire et une signature côté serveur,
  que Huntited n'a pas. Le service choisi demande une pièce d'identité ;
  Huntited ne touche pas l'argent.

## Limites

- Réseau de test seulement : à faire auditer avant de vrais KAS.
- Sans protection, la phrase est en clair dans le navigateur.
- Un code à chiffres arrête quelqu'un qui prend le téléphone, pas une copie
  des données du navigateur (essais hors ligne). Mot de passe ou empreinte :
  plus solides.
