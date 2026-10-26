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
- La phrase n'est pas chiffrée par un code : quiconque a accès au navigateur
  déverrouillé peut l'afficher. Piste : code ou empreinte (app).
