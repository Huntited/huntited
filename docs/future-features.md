# Fonctionnalités futures — idées en réserve

Ces pistes ne font **pas partie du MVP**. Elles ne seront étudiées que si l'usage réel en démontre le besoin.

## Veto des engagés

Une annulation collective en cas d'abus avéré, réservée aux engagés. Son dépôt, son seuil et ses effets restent à concevoir. Cette fonction est écartée du MVP afin d'éviter les attaques coordonnées et de garder le protocole lisible.

## Dépôt d'engagement variable

Le créateur pourrait choisir un montant entre des bornes définies. Le MVP conserve un dépôt unique de 5 KAS pour une expérience simple et prévisible.

## Réputation

Une réputation on-chain ou hors-chaîne pourrait refléter l'historique des créateurs et des engagés, sans compromettre leur confidentialité.

## Assurance collective et DeFi

Un fonds de secours pourrait aider après un bug ou financer certains dépôts. Le placement temporaire des fonds est aussi une piste, mais ces mécanismes ajoutent des risques financiers incompatibles avec le MVP.

## Salons chiffrés avancés

Relais Nostr propre à Huntited (chez un CHATONS), modération anti-doxxing et historique optionnel.

## Indexer et explorateur

Un service dédié pourra suivre les événements on-chain et alimenter la recherche, les listes et les statistiques, sans exposer les identités.

## Gouvernance du treasury

La multi-signature initiale pourra évoluer vers une gouvernance plus décentralisée lorsque les flux réels et les besoins seront établis.

## Priorité indicative

1. Indexer et explorateur après le déploiement on-chain.
2. Salons chiffrés avancés selon les besoins de coordination.
3. Veto des engagés uniquement si des abus réels le justifient.
4. Réputation, assurance, DeFi et gouvernance décentralisée à plus long terme.

## Gamification (en réserve)

Chaque mission = une quête ; les engagés = une team ; la participation vérifiée = quête accomplie.

- **XP** : mission accomplie +100, mission créée et réussie +150, bonus de série (tous les 3 succès consécutifs) +50.
- **Niveau** : `floor(sqrt(xp / 100)) + 1` (0 XP → 1, 100 → 2, 400 → 3, 900 → 4).
- **Badges** : Premier pas, Fiable (5), Esprit d'équipe (10), Initiateur, En série (3 consécutifs), Vétéran (25).
- **Profil** : niveau, XP, missions accomplies, missions créées réussies, série en cours, badges.
- **Idées** : leaderboards par ville (opt-in, pseudos masquables), guildes, saisons et événements, quêtes collectives.
