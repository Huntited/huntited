# Signature de message Kastle — ce que fait réellement le code

Lu dans les sources le 5 octobre 2026 (branche `main` de `forbole/kastle`
et `master` de `kaspanet/rusty-kaspa`). À relire si la version de Kastle change.

## Chemin d'un appel `window.kastle.signMessage(message)`

1. `api/browser.ts` — envoie une requête `Action.SIGN_MESSAGE` à l'extension
   (le message doit être une chaîne non vide).
2. `api/background/handlers/kaspa/signMessage.ts` — refuse si l'extension n'est
   pas initialisée ou si le site n'est **pas connecté** (`Host not connected`),
   puis ouvre la fenêtre Kastle sur `/sign-message`.
3. `components/screens/browser-api/kaspa/sign-message/SignMessage.tsx` — après
   accord de l'utilisateur : `walletSigner.signMessage(message)`, et la valeur
   renvoyée est transmise **telle quelle** au site.
4. Compte classique (`lib/wallet/account/hot-wallet-account.ts`) :
   `signMessage({ message, privateKey })` du SDK WebAssembly officiel de Kaspa,
   **sans** `noAuxRand`.
5. Compte Ledger (`lib/wallet/account/ledger-account.ts`) : passe par
   `hw-app-kaspa` (`app.signMessage(...)`). **Format non vérifié** à ce jour.

## Algorithme (rusty-kaspa, `wallet/core/src/message.rs`)

- Empreinte : **Blake2b**, sortie 32 octets, **clé** = `"PersonalMessageSigningHash"`,
  sur les octets du message.
- Signature : **Schnorr secp256k1 (BIP-340)** sur cette empreinte, 64 octets,
  avec aléa auxiliaire (donc non déterministe : deux signatures du même message
  diffèrent, les deux sont valides).
- Valeur renvoyée au site : **64 octets en hexadécimal** (128 caractères).
- Vérification (`verify_message`) : clé publique **x-only** (32 octets).

## Conséquences pour Huntited (étape « défi signé »)

- Le serveur peut vérifier la signature contre la clé x-only contenue dans
  l'adresse elle-même (adresses Schnorr `kaspatest:q…`), ce qui prouve le
  contrôle de l'adresse sans faire confiance à la `publicKey` envoyée par le
  navigateur.
- Implémentation possible en Node : `@noble/hashes` (blake2b avec `key`) +
  `@noble/curves` (`schnorr.verify`) + décodage de l'adresse Kaspa. À valider
  impérativement contre les vecteurs de test de `message.rs` (rusty-kaspa).
- Alternative : le SDK WebAssembly officiel de Kaspa (`verifyMessage`).
- Comptes Ledger : à tester avant de les accepter.
