# Registre des chasses sur Kaspa — conception (à valider)

But : qu'aucun serveur Huntited ne soit l'autorité. N'importe qui peut
reconstruire l'état de toutes les chasses en lisant la blockchain, et
n'importe qui peut faire tourner un serveur (index, relais, site).

## Le problème à résoudre : la blockchain est publique

Si chaque personne s'engage depuis son propre wallet, **son adresse est
visible par tout le monde, liée à la chasse**. C'est l'inverse de la promesse
de Huntited (« personne ne voit qui s'est engagé »). Kaspa n'a pas de
mécanisme de confidentialité intégré.

## La solution proposée : preuves anonymes + relais

1. **Chaque chasse et chaque engagement est une transaction Kaspa** qui
   porte un petit message (« payload », quelques centaines d'octets) envoyé
   vers une adresse publique connue, « l'adresse du registre ».
2. **Un engagement ne contient aucune adresse personnelle** : il contient
   la preuve Semaphore qu'on utilise déjà (un pass valide, une seule fois par
   chasse) et le seuil personnel scellé dans la preuve.
3. **Un relais paie les frais et publie la transaction.** La personne
   envoie sa preuve au relais ; le relais ne peut pas tricher (la preuve est
   vérifiée par tout le monde) ni savoir qui elle est. **N'importe qui peut
   faire tourner un relais**, et chacun peut publier lui-même s'il accepte
   d'être visible.
4. **L'état d'une chasse se calcule en lisant la chaîne** (index) : liste
   des transactions vers l'adresse du registre, vérification des preuves,
   mêmes règles qu'aujourd'hui (seuil, seuil personnel, date limite).
   Plusieurs index indépendants donnent forcément le même résultat.

Le groupe des pass (les empreintes anonymes) et les invitations passent
aussi sur la chaîne, de la même façon.

## Choix précis (étape 1, faite)

Code : `backend/src/chain/protocol.ts` (format) et `backend/src/chain/ledger.ts`
(règles), testés avec de vraies preuves (`ledger.test.ts`).

- **Message** : `HNT1` + JSON. Quatre types : `invite`, `pass`, `hunt`,
  `commit`. Tout message invalide est ignoré.
- **Invitations** : le code d'invitation est une clé secrète (secp256k1).
  `invite` publie la clé publique, avec une preuve de pass (quota mensuel,
  emplacement anonyme). `pass` ajoute un pass en **signant** son empreinte
  avec la clé : quelqu'un qui voit passer la transaction ne peut pas voler
  l'invitation pour son propre pass. Invitations de départ : listées dans la
  configuration du registre (« genesis »).
- **Chasse** : il faut un pass pour en créer une (anti-spam, le relais paie).
  Le contenu est scellé dans la preuve : le relais ne peut rien modifier. La
  preuve de création permet ensuite au créateur de se faire reconnaître (même
  code), sans wallet.
- **Engagement** : preuve de pass pour `hunt:<id>`, seuil personnel scellé.
  Une personne = un engagement par chasse. Accepté jusqu'à la date limite
  (heure du bloc).
- **Issue** : calculée, sans transaction de clôture : déclenchée avant la date
  limite = succès, sinon échec.
- **Ordre** : celui dans lequel la chaîne accepte les transactions ; l'heure
  utilisée est celle des blocs, jamais une horloge locale. Deux index qui
  lisent les mêmes transactions obtiennent exactement le même état (testé).

### Conséquences à connaître

- **Le wallet n'est plus nécessaire pour s'engager** dans cette phase : le
  pass suffit (le wallet reviendra avec les vrais dépôts).
- **« Masquer la progression » ne cache plus rien** : n'importe qui peut
  compter les engagements sur la chaîne. L'option devient purement
  visuelle ; à dire dans l'interface, ou à retirer.
- **Le seuil personnel est public** (il est dans la preuve), mais jamais relié
  à une personne.
- Créer une chasse demande un pass (aujourd'hui, seul l'engagement en
  demandait un).

## Ce qui ne change pas tout de suite

- **Dépôts (5 KAS) et caution : toujours simulés.** Bloquer de vrais KAS de
  façon anonyme demande une « réserve de confidentialité » (privacy pool) que
  Kaspa ne propose pas encore simplement. Ce sera la phase suivante, avec les
  covenants (KIP-10) limités aux états actif / déclenché / expiré.
- Le chat (Matrix) et les notifications restent des services à part,
  facultatifs.

## Étapes

1. **Format des messages** (chasse, engagement, pass, invitation) et
   règles de l'index, testés hors ligne.
2. **Index** : lecture de l'adresse du registre sur testnet-10, vérification
   des preuves, reconstruction de l'état ; le backend actuel devient un index
   parmi d'autres.
3. **Relais** : un portefeuille de relais (KAS de test, faucet) qui publie
   les messages ; limites anti-abus.
4. **Front** : lit l'état via n'importe quel index (adresse configurable),
   publie via n'importe quel relais.
5. **Migration** : les chasses de test actuelles ne sont pas reprises.

## Ce qu'il faut accepter

- **Des vraies transactions sur le réseau de test** (testnet-10), payées en
  KAS de test sans valeur, obtenus gratuitement (faucet).
- **Se connecter au réseau Kaspa de test** (nœuds publics) pour lire et
  publier.
- **La clé du portefeuille de relais** est un secret du serveur relais
  (comme le jeton Matrix aujourd'hui), jamais dans le navigateur.
- Les titres, lieux et dates des chasses deviennent **inscrits pour
  toujours** dans la chaîne (ils sont déjà publics, mais aujourd'hui on peut
  les effacer). À dire clairement dans les conditions.
