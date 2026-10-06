# Bots et multiplication de wallets

## Le problème

Un wallet ne coûte rien à créer. Sans parade, une seule personne peut :

1. **ramasser les récompenses** en engageant beaucoup de wallets ;
2. **provoquer un faux déclenchement** : des wallets bots font franchir le
   seuil, l'action se lance avec trop peu de vraies personnes, qui se
   retrouvent exposées. C'est le risque le plus grave pour Huntited.

## Ce qui est en place (prototype)

- Récompense **uniquement en cas de succès**, plafonnée à **1 KAS par
  engagé** : engager des bots sur une chasse vouée à l'échec ne rapporte
  rien, et un créateur ne récupère presque rien avec ses propres wallets.
- Seuil minimum de **7 personnes**.
- Un engagement par wallet et par chasse ; limites de fréquence par IP.

Ces mesures retirent l'**intérêt financier** des bots, pas le **faux
déclenchement** : quelqu'un de malveillant (ou de trop zélé) peut encore
gonfler le compteur sans chercher à gagner d'argent.

## La cible : « une personne = un engagement », de façon anonyme

L'idée vient de Semaphore (protocole ZK utilisé par plusieurs votes et
sondages anonymes). Elle a deux étapes.

### 1. S'inscrire une fois comme « vraie personne »

Chaque personne crée sur son appareil un **secret** (jamais partagé) et en
publie une **empreinte** (son « identité Huntited »). Pour que cette
empreinte entre dans la **liste des personnes vérifiées**, il faut une preuve
qu'on est une vraie personne qui n'est pas déjà inscrite. Plusieurs façons
possibles, à choisir :

- **Parrainage** : une personne déjà inscrite invite et se porte garante ;
  si son invité s'avère être un bot, elle perd sa capacité à inviter.
- **Preuve d'humanité externe** : Human Passport (ex-Gitcoin Passport),
  BrightID, World ID…
- **Rencontre en personne** lors d'une action (scan d'un QR code).

La liste ne contient que des empreintes : elle ne dit pas qui est qui.

### 2. S'engager avec une preuve, sans se révéler

Pour s'engager dans une chasse, le téléphone calcule une **preuve ZK** qui
dit, sans rien révéler d'autre :

- « je connais le secret d'**une** des empreintes de la liste » (donc je suis
  une personne vérifiée), sans dire laquelle ;
- un **nullifier** = empreinte(secret + identifiant de la chasse).

Le nullifier est toujours le même pour une personne et une chasse donnée,
mais différent d'une chasse à l'autre. Le covenant refuse un nullifier déjà
vu : **impossible de s'engager deux fois dans la même chasse**, même avec dix
wallets. Et comme les nullifiers de deux chasses n'ont rien en commun,
**personne ne peut relier tes engagements entre eux**, ni à ton identité.

### Ce que ça résout

| Problème                                        | Résolu ?                                     |
| ----------------------------------------------- | -------------------------------------------- |
| Multiplier les wallets pour gonfler le compteur | Oui : une personne = un nullifier par chasse |
| Faux déclenchement par des bots                 | Oui : seuls les inscrits comptent            |
| Créateur qui s'engage avec ses propres wallets  | Oui : il ne compte qu'une fois               |
| Relier un engagement à une personne             | Impossible, même pour Huntited               |

### Ce que ça ne résout pas

- La qualité de l'inscription : si l'étape 1 est facile à tromper, la liste
  contiendra des bots. Le parrainage limite la casse (un parrain fautif est
  identifiable dans l'arbre d'invitations, sans révéler les engagements).
- La présence réelle à l'action : volontairement non prouvée (une preuve de
  présence est aussi une preuve utilisable contre la personne).

### Coût technique

- Circuits ZK (Semaphore existe déjà en Circom/Noir) et vérification des
  preuves par le covenant Kaspa : c'est la partie ZK déjà prévue à la feuille
  de route.
- Génération de preuve sur téléphone : quelques secondes.

## Où on en est

1. **Fait** : récompense de succès uniquement, plafonnée.
2. **Fait (prototype)** : pass Huntited.
   - **Inscription par invitation** : un membre crée un lien d'invitation
     depuis « Mon pass » (3 par mois). Il prouve anonymement qu'il a un pass
     (preuve Semaphore, scope `invite:<mois>:<n>`) : le serveur applique le
     quota **sans savoir quel membre invite**, et ne garde jamais le lien
     parrain → filleul. Le code est dans la partie `#` du lien (jamais envoyé
     au serveur de la page), valable 7 jours, une seule fois.
   - **Amorçage** : `PASS_GENESIS_INVITES` (invitations de départ).
   - **Engagement** : si `PASS_REQUIRED=true`, chaque engagement porte une
     preuve Semaphore (scope `hunt:<id>`, seuil personnel scellé dans le
     message). Le serveur refuse un même code (nullifier) deux fois dans une
     chasse, même depuis un autre wallet.
   - **Preuves calculées sur l'appareil** (≈ 1 à 5 s), sur un seul fil pour
     ménager la mémoire des téléphones ; fichiers de calcul servis par le site
     (`public/zk`, profondeur 20 : la taille réelle du groupe n'est pas révélée).
3. **À faire** :
   - vérifier les preuves dans le covenant Kaspa (aujourd'hui : le serveur) ;
   - un dépôt qui ne relie pas le wallet à l'engagement (aujourd'hui, le
     serveur sait quel wallet s'engage, comme avant les pass) ;
   - d'autres portes d'entrée au choix : rencontre en personne (QR code qui
     change), passeport ZK en option.

## Données conservées par le serveur

| Donnée                                            | Pourquoi                     | Révèle                                               |
| ------------------------------------------------- | ---------------------------- | ---------------------------------------------------- |
| Empreintes des pass (commitments)                 | Calculer les preuves         | Rien sur qui est qui                                 |
| Empreintes (sha256) des invitations non utilisées | Les accepter une fois        | Rien                                                 |
| Codes d'emplacements d'invitation utilisés        | Quota mensuel                | Rien (codes différents à chaque mois et emplacement) |
| Code de pass par engagement                       | Une personne = un engagement | Rien hors de cette chasse                            |

Le secret du pass reste sur l'appareil (stockage du navigateur). Sans
sauvegarde (écran « Mon pass »), il est perdu avec l'appareil.
