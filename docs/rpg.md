# Côté RP : expérience, niveaux, classes, quêtes

Non financier : rien ne change les montants (`src/lib/rpg.ts`).

## XP : seulement des actions réelles, vérifiables

L'XP vient des actes d'un wallet inscrits sur la blockchain
(`chainDeeds`) ; rien ne compte tant que la chasse ne s'est pas déclenchée :

| Acte | XP |
| --- | --- |
| Engagement dans une chasse déclenchée | 20 |
| … qui a compté pour le déclenchement | +10 |
| Création d'une chasse déclenchée | 80 |
| Chasse déclenchée arrivée à sa date (action réalisée) | +30 (membre), +50 (créateur) |
| Quêtes de la semaine (lundi–dimanche, UTC) | 30 / 40 / 50 |

Niveau `L` à partir de `50 × L × (L − 1)` XP (2 : 100, 3 : 300, 4 : 600…).
Titres : Recrue, Apprenti·e, Pisteur·euse, Traqueur·euse, Meneur·euse,
Vétéran·e, Légende.

## Classes

Éclaireur·euse (+25 % engagements), Stratège (+25 % créations),
Gardien·ne (+25 % réussites), Rallieur·euse (+25 % quêtes). Choisie sur
l'appareil (`rpg-profile.ts`), envoyée chiffrée avec les messages du salon.

## Où ça se voit

- Page « Ma progression » (`/profile`) : rang, barre d'XP, classe, quêtes.
- Salons : « Niv. N · classe » à côté du pseudo, pour les membres seuls.
  Chaque membre recalcule le niveau des autres à partir des engagements
  publics (clé de chat → wallet, `getChainMemberDeeds`) : impossible de
  tricher. Les places d'organisation (sans wallet) n'ont pas de niveau.

## Avoir vraiment « joué le jeu » (pistes)

Aujourd'hui, une chasse « réussie » = déclenchée et arrivée à sa date : on
sait que la personne s'est engagée, pas qu'elle est venue. Pour récompenser la
présence réelle sans la rendre publique :

1. **Attestations entre membres** (app, Bluetooth) : sur place, les téléphones
   des membres échangent des signatures « j'ai croisé ce membre » avec leur
   clé de chat. Assez d'attestations distinctes = présence prouvée aux autres
   membres, sans lieu ni heure publics.
2. **QR du créateur** : le créateur affiche un QR signé et daté sur place ; le
   scanner prouve la présence (plus simple, mais dépend du créateur).
3. **Vote des membres** après l'action (« présent·e / absent·e »), chiffré
   dans le salon.

Rien n'est inscrit sur la blockchain : la présence reste entre membres.
