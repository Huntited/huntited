# Notifications « me prévenir » et effacement des chasses ratées

## Me prévenir (Web Push)

Sur la page d'une chasse en cours, le bouton **« Me prévenir du résultat »**
abonne le navigateur à cette chasse. Une notification arrive quand :

- la chasse **se déclenche** (envoyée immédiatement) ;
- la chasse **échoue** à sa date limite (envoyée par la tâche périodique,
  dans la minute qui suit).

Un clic sur la notification ouvre la chasse.

**Vie privée**

- Ni compte, ni wallet, ni session : le serveur garde seulement l'adresse de
  livraison du navigateur (endpoint + clés), l'id de la chasse et la langue.
- **Abonnements supprimés dès l'envoi** (les deux événements sont définitifs).
- Message **chiffré de bout en bout** (RFC 8291) : le service de push du
  navigateur (Google, Mozilla, Apple, Microsoft) le transporte sans le lire.
  Il contient l'id et le titre (public) de la chasse.
- Le service worker (`public/sw.js`) n'est installé qu'au premier « Me
  prévenir » accepté ; il ne fait rien d'autre (pas de cache, pas de suivi).
- Sécurité : le serveur n'envoie qu'aux services de push connus
  (`routes/push.ts`, `isPushEndpoint`), jamais à une adresse arbitraire.

**Configuration** (`backend/.env`) — sans clés, la fonction est désactivée et
le bouton n'apparaît pas :

```env
PUSH_VAPID_PUBLIC_KEY=...
PUSH_VAPID_PRIVATE_KEY=...   # backend-only
PUSH_SUBJECT=mailto:Huntited@proton.me
PUSH_FILE=data/push.json
```

Générer la paire une fois : `npx web-push generate-vapid-keys` (dans
`backend/`). En développement, `scripts/dev-shared.ps1` la crée dans
`backend/data/vapid.json` (hors git). Changer de clés invalide les abonnements
existants.

**Tester** : Chrome, Firefox ou Edge, sur `localhost` ou en https (pas sur
l'adresse IP du PC : les notifications exigent un contexte sécurisé). Sur
iPhone, seulement après « Ajouter à l'écran d'accueil ».

## Effacement des chasses ratées

24 h après la date limite d'une chasse non déclenchée, le registre efface ses
engagements : empreintes, seuils personnels et codes de pass. Seul leur
**nombre** reste (`purgedCommitCount`) pour l'affichage. L'activité d'un
wallet (`/api/me`) ne montre donc plus ces engagements côté serveur.

Tâche : `backend/src/services/maintenance.ts` (toutes les minutes, avec la
fermeture des salons de chat et les notifications d'échec).
