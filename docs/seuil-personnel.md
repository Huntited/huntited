# Seuil personnel — conception (à valider avant développement)

> « Je viens si au moins N personnes viennent. »
> Inspiré du texte Staghunt : chacun fixe son propre niveau d'assurance.

## 1. Idée

Aujourd'hui, une chasse a **un seul seuil**, fixé par le créateur (ex. 10).
Avec le seuil personnel, chaque engagé·e peut **ajouter sa propre condition** :

- Alice : « je viens si au moins 10 personnes viennent » (le seuil de la chasse) ;
- Bruno : « je viens seulement si nous sommes au moins 25 ».

Un professeur titulaire peut se lancer à 5, un stagiaire à 50 : chacun avec
son niveau de risque, dans la même chasse.

## 2. Règles proposées

- Le **seuil de la chasse** (T) reste le minimum pour que l'action ait lieu.
- Chaque engagé·e choisit un **seuil personnel** `t ≥ T` (par défaut `t = T`,
  ce qui donne exactement le comportement actuel).
- Le **groupe retenu** est le plus grand groupe dans lequel la condition de
  chaque membre est satisfaite (chacun voit au moins `t` personnes dans le
  groupe, lui compris).
- La chasse **s'active** dès que ce groupe atteint T.
- Un·e engagé·e **hors du groupe retenu** (sa condition n'est pas remplie) ne
  participe pas : **son dépôt de 5 KAS lui est rendu intégralement**, il ne
  paie rien.

### Calcul du groupe retenu (simple et exact)

On trie les seuils personnels. Le groupe retenu est `{ engagés avec t ≤ k* }`
où `k*` est le plus grand nombre tel qu'_*au moins k* engagés ont un seuil ≤ k_**.
Le groupe ne peut que **grandir** quand quelqu'un s'engage : une activation
n'est jamais remise en cause.

Exemple, T = 3, seuils : 3, 3, 4, 10.

- k = 3 : 2 seuils ≤ 3 → non ; k = 4 : 3 seuils ≤ 4 → non ;
- → personne n'est retenu, chasse **pas encore active**.
- Un 5e engagé avec t = 3 arrive : k = 4 → 4 seuils ≤ 4 → **groupe de 4**, la
  chasse s'active ; la personne à 10 reste hors du groupe (remboursée).

## 3. Économie

> **Décidé le 6 octobre 2026 :** en cas de succès, un·e engagé·e non retenu·e
> récupère ses 5 KAS **sans récompense** (un seuil personnel
> inatteignable ne doit pas rapporter de gain garanti).

Appliquée **au groupe retenu** (règles complètes : `docs/economics.md`) :

- **Succès** : chaque membre du groupe retenu récupère ses 5 KAS + sa
  récompense (jusqu'à 1 KAS) ; les engagé·es **non retenu·es** récupèrent
  leurs 5 KAS (sans récompense).
- **Échec** (groupe retenu < T à la date limite) : chaque engagé·e récupère
  ses 5 KAS, sans récompense.

## 4. Confidentialité

- Le seuil personnel de chacun reste **privé** : il n'est jamais affiché aux
  autres ni renvoyé publiquement (le serveur le garde lié à l'empreinte
  d'engagement, comme le reste).
- Pour une chasse à progression masquée, la taille du groupe retenu reste
  masquée elle aussi jusqu'à la fin de la phase d'engagement.
- Chaque engagé·e voit, pour lui seul : « ta condition est remplie » ou « en
  attente de ta condition ».

## 5. Interface

- Fenêtre d'engagement : « Je viens si au moins **[N]** personnes viennent »
  (prérempli avec le seuil de la chasse, minimum T).
- Page de la chasse, pour l'engagé·e : statut de sa propre condition.
- Badges : « Déclencheur·se » = l'engagement qui a fait atteindre T au groupe
  retenu.

## 6. Que se passe-t-il après l'activation ?

> **Décidé le 5 octobre 2026 : option B** (engagements ouverts jusqu'à la date limite).

**Option A — on ferme à l'activation (comme aujourd'hui).**
Simple. Mais une personne exigeant 25 dans une chasse à 10 n'a presque aucune
chance d'être retenue : la chasse s'active à 10 et ferme.

**Option B — on reste ouvert jusqu'à la date limite (recommandé).**
La chasse s'active dès que le groupe atteint T (le chat s'ouvre pour ce
groupe), puis les engagements **restent ouverts** jusqu'à la date limite : le
groupe peut grandir et intégrer ceux qui demandaient plus. C'est ce qui rend
le seuil personnel utile. Le groupe ne fait que grandir, l'activation n'est
jamais annulée ; le règlement se fait sur le groupe final.

Conséquence de B : la règle actuelle « activée = engagements fermés » change,
et le bouton « S'engager » reste visible sur une chasse activée jusqu'à la
date limite.

## 7. Mise en œuvre (après validation)

1. Fonction pure `computeRetainedGroup(seuils, T)` + tests.
2. Registre : seuil personnel stocké avec l'engagement, groupe retenu calculé
   à chaque engagement, règlement sur le groupe retenu.
3. Économie : `calculateSettlement` reçoit retenus / non retenus.
4. Interface : champ dans la fenêtre d'engagement, statut personnel.
5. Mode local (démo) aligné sur les mêmes règles.
