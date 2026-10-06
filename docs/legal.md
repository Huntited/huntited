# Page légale (conditions, vie privée, charte)

Contenu : `src/lib/legal-content.ts` (français et anglais, même structure,
vérifiée par `legal-content.test.ts`). Page : `/legal`, liée depuis le pied de
page et la fenêtre d'engagement.

## Statut : modèle, à faire relire

Le texte a été rédigé pour coller au fonctionnement réel de Huntited (aucun
compte, empreintes au lieu des adresses, recherche de villes locale, chat
supprimé 24 h après la date limite…). **Il doit être relu par un·e juriste
avant l'ouverture au public**, en particulier :

- la responsabilité liée à l'organisation d'actions collectives (droit de
  réunion, déclaration de manifestation selon les pays) ;
- la qualification des dépôts en KAS quand ils seront réels ;
- les mentions RGPD (base légale, durée de conservation, droits).

## À compléter à la mise en ligne

| Élément                                                     | Où                          | Valeur                          |
| ----------------------------------------------------------- | --------------------------- | ------------------------------- |
| Éditeur (nom ou raison sociale, adresse si personne morale) | `[éditeur]` / `[publisher]` | à définir                       |
| Hébergeur (nom, adresse)                                    | `[hébergeur…]` / `[host…]`  | selon le choix d'hébergement    |
| Contact                                                     | `LEGAL_CONTACT`             | `Huntited@proton.me`            |
| Date de mise à jour                                         | `LEGAL_UPDATED`             | à changer à chaque modification |

Une fois relu, retirer le bandeau « version de test » (`legal.draft`).
