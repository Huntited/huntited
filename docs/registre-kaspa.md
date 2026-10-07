# Registre des chasses sur Kaspa — conception

But : qu'aucun serveur Huntited ne soit l'autorité. N'importe qui peut
reconstruire l'état de toutes les chasses en lisant la blockchain, et
n'importe qui peut faire tourner un index ou héberger le site.

Décisions (2026-10-07) :

- **N'importe qui peut créer et rejoindre une chasse** avec son wallet. Le
  pass reste en réserve (désactivé par défaut).
- **Le wallet est au centre** : chaque chasse et chaque engagement est une
  transaction envoyée depuis le wallet Kastle de la personne, qui portera le
  dépôt (5 KAS) ou la caution.
- **Réseau de test uniquement** (testnet-10, KAS de test sans valeur).

## Comment ça marche

1. Une chasse, un engagement = une transaction **envoyée depuis le wallet**
   vers « l'adresse du registre », avec un petit message (payload) : préfixe
   `HNT1` + JSON. Tout message invalide est ignoré.
2. **L'identité est l'adresse qui envoie** : un wallet = un engagement par
   chasse ; le créateur est l'adresse qui a créé la chasse (il se fait
   reconnaître en signant avec, comme aujourd'hui).
3. L'état se calcule en relisant la chaîne dans l'ordre où elle accepte les
   transactions, avec l'heure des blocs (jamais une horloge locale). Deux
   index indépendants obtiennent exactement le même état.
4. Issue calculée, sans transaction de clôture : déclenchée avant la date
   limite = succès, sinon échec.

Code : `backend/src/chain/protocol.ts` (format), `backend/src/chain/ledger.ts`
(règles), testés dans `ledger.test.ts`.

## Vie privée : ce qui est public

Une transaction depuis un wallet montre, **publiquement et pour toujours**,
que cette adresse s'est engagée dans cette chasse. Huntited n'affiche jamais
d'adresse, mais quiconque lit la blockchain peut faire le lien. Le créateur
de la chasse n'a pas plus d'informations que n'importe qui.

### Adresse de financement / adresse d'exécution

Recommandation à l'utilisateur, inspirée des bonnes pratiques des wallets HD :

- **adresse de financement** : reçoit les KAS (faucet, plateforme d'échange,
  amis) ; jamais utilisée sur Huntited ;
- **adresse d'exécution** : un **compte « Huntited » créé dans Kastle**,
  connecté au site ; sert à créer, s'engager, et reçoit remboursements et
  récompenses.

Huntited ne peut pas dériver d'adresses dans le wallet (Kastle ne donne
jamais la graine à un site, et c'est voulu) : c'est à la personne de créer le
compte ; l'application l'explique à la connexion.

**Limite** : si l'adresse d'exécution est alimentée par un transfert depuis
l'adresse de financement, ce transfert est public et relie les deux. La
séparation protège alors contre un observateur occasionnel, pas contre
quelqu'un qui cherche. Elle est efficace si l'adresse d'exécution est
alimentée **directement** depuis l'extérieur (faucet, retrait d'une
plateforme, un ami).

### En réserve : le pass (anonymat complet)

Activable (`Genesis.passRequired`) : chasses et engagements portent une
preuve Semaphore et sont publiés par un relais qui paie les frais ; aucune
adresse personnelle n'apparaît. Invitations sur la chaîne : le code est une
clé secrète à usage unique, et l'utiliser revient à signer son pass (une
invitation vue en route ne peut pas être volée). Limite : un dépôt payé
depuis un wallet ne peut pas être anonyme tant qu'il n'existe pas de
« réserve de confidentialité » sur Kaspa.

## Ce qui reste à part

- **Dépôts et caution : simulés** pour l'instant. Les vrais montants viendront
  avec les covenants (KIP-10), limités aux états actif / déclenché / expiré.
- « Masquer la progression » reste une option d'affichage : sur la chaîne,
  le nombre d'engagements est lisible par qui le cherche.
- Le chat (Matrix) et les notifications restent des services facultatifs.

## Adresse du registre

`kaspatest:qr2ck8qnt0rtj7spzd7am9tsmtd5j4l3tgtah3tzz89l9jvcfg5uvc33cl3yj`

Dérivée de la phrase publique `huntited:registry:v1` (`chain/registry-address.ts`) :
un point de la courbe obtenu par hachage, dont **personne ne connaît la clé
privée**. Chacun peut refaire le calcul. Les KAS envoyés à cette adresse ne
peuvent être dépensés par personne (perdus).

## Publication depuis Kastle (vérifié dans le code de Kastle)

`window.kastle.sendKaspa(adresse, sompi, { payload })` : Kastle construit la
transaction depuis le compte connecté, rend la monnaie à ce compte, et ouvre
sa fenêtre de signature. Contraintes lues dans
`api/background/handlers/kaspa/sendSompi.ts` :

- `payload` en **hexadécimal** ;
- **0,2 KAS minimum** envoyés : chaque action (créer, s'engager) envoie donc
  0,2 KAS de test à l'adresse du registre ;
- une seule transaction (sinon refus « batch required »).

## Étapes

1. ✅ **Format et règles**, testés hors ligne.
2. ✅ **Index** (`chain/indexer.ts`) : lit l'API publique du réseau de test
   (`KASPA_API_URL`), rejoue dans l'ordre (score du bloc qui accepte, puis
   identifiant) les transactions **finales** (600 de profondeur, ≈ 1 min).
   Activé par `CHAIN_INDEX=true`. Routes publiques sans aucune adresse :
   `GET /api/chain/status`, `/api/chain/hunts`, `/api/chain/hunts/:id`.
   Vérifié sur le vrai réseau de test (lecture seule).
3. **Publication depuis Kastle** : le site envoie le message avec
   `sendKaspa(adresse du registre, 0,2 KAS, { payload })`.
4. **Front** : lit l'état via n'importe quel index (adresse configurable) ;
   écran de connexion qui explique le compte « Huntited ».
5. **Textes** : l'accueil, la FAQ et la page légale disent aujourd'hui que
   personne ne voit qui s'est engagé ; à corriger **au moment où le registre
   sur la chaîne remplace le serveur** (pas avant : c'est encore vrai).
6. **Covenants** : vrais dépôts et remboursements.

## Ce qu'il faut accepter

- Des vraies transactions sur le réseau de test, payées en KAS de test.
- Se connecter aux nœuds publics du réseau de test.
- Les titres, lieux et dates des chasses sont **inscrits pour toujours** dans
  la chaîne (à dire dans les conditions).
