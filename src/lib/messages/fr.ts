// Textes de l'interface en français (langue de référence).
// Chaque clé doit exister aussi dans en.ts (vérifié par le typage).
export const fr = {
  // En-tête et navigation
  "nav.hunts": "Chasses",
  "nav.create": "Créer",
  "nav.myHunts": "Mes chasses",
  "nav.pass": "Mon pass",
  "nav.menu": "Menu",
  "nav.home": "Accueil Huntited",
  "lang.switch": "Langue",
  "nav.open": "Ouvrir le menu",
  "nav.close": "Fermer le menu",
  "theme.dark": "Passer en thème sombre",
  "theme.light": "Passer en thème clair",
  "a11y.skip": "Aller au contenu",
  "wallet.connect": "Connecter le wallet",
  "wallet.connecting": "Connexion…",
  "wallet.disconnect": "Déconnecter",
  "footer.tagline": "Tout le monde ou personne. Aucune donnée personnelle.",
  "footer.testnet": "Version de test : aucun vrai KAS.",
  "dev.reset": "Réinitialiser les données de démonstration",
  "dev.resetConfirm": "Réinitialiser les données de démonstration Huntited ?",

  // Pages d'erreur
  "notFound.title": "Cette page n'existe pas",
  "notFound.text": "Le lien est peut-être incomplet, ou la chasse a été retirée.",
  "notFound.home": "Voir les chasses",
  "notFound.create": "Créer une chasse",
  "error.title": "Cette page n'a pas pu s'afficher",
  "error.text":
    "Un problème est survenu de notre côté. Réessaie, ou reviens à l'accueil. Rien n'a été envoyé ni engagé.",
  "error.retry": "Réessayer",
  "error.home": "Retour à l'accueil",
  "common.back": "← Retour",
  "common.loading": "Chargement…",

  // Statuts d'une chasse
  "status.draft": "Brouillon",
  "status.active": "En cours",
  "status.activated": "Seuil atteint",
  "status.expired": "Expirée",
  "status.settled": "Résolue",
  "status.aria": "Statut : {label}",

  // Accueil
  "home.title": "Agir ensemble, sans y aller seul",
  "home.lead":
    "Tu voudrais agir, mais pas seul·e. Ici, tu t'engages en privé, et l'action n'a lieu que si assez de monde suit.",
  "hunt.explain":
    "Ici, personne n'y va seul·e : ton engagement ne compte que si au moins {threshold} personnes s'engagent avant la date limite. Sinon, ton dépôt t'est rendu.",
  "hunt.explain.link": "Comment ça marche ?",
  "home.browse": "Voir les chasses",
  "home.example.title": "Comment ça marche, avec un exemple",
  "home.example.1":
    "Sam veut défendre le parc du quartier au conseil municipal du 12 mars. Seul·e, Sam n'ira pas. Sam crée une chasse : « On y va si on est au moins 20 ».",
  "home.example.2":
    "Les voisins s'engagent, chacun de son côté, avec un dépôt de 5 KAS. Personne ne voit qui s'est engagé, pas même Sam.",
  "home.example.3":
    "Au 20e engagement, la chasse se déclenche : tout le monde est prévenu et un chat chiffré s'ouvre pour s'organiser. Si on n'arrive pas à 20, rien ne se passe : chacun récupère son dépôt, et personne ne saura qui était partant.",
  "home.example.cardLabel": "Exemple de chasse",
  "home.example.cardTitle": "Conseil municipal : sauvons le parc",
  "home.example.cardMeta": "Mairie · avant le 12 mars",
  "home.example.cardProgress": "14 sur 20 engagés",
  "home.faq.title": "Questions",
  "home.faq.wallet.q": "Il faut un wallet ?",
  "home.faq.wallet.a":
    "Oui, un wallet Kaspa, par exemple Kastle. Pour l'instant, tout se passe sur le réseau de test : aucun vrai KAS n'est utilisé.",
  "home.faq.deposit.q": "Pourquoi un dépôt ?",
  "home.faq.deposit.a":
    "Pour que l'engagement compte : on réfléchit avant de cliquer, et créer de faux engagements coûte cher. Le dépôt est toujours rendu à la fin.",
  "home.faq.who.q": "Qui sait que je me suis engagé·e ?",
  "home.faq.who.a":
    "Personne. Le serveur ne garde qu'une empreinte qui ne permet pas de remonter à ton wallet, et la personne qui a créé la chasse ne voit pas qui s'est engagé.",
  "home.faq.after.q": "Et si la chasse se déclenche ?",
  "home.faq.after.a":
    "Tu restes libre : Huntited ne force personne. Mais tu sais que tu ne seras pas seul·e, et le chat permet de s'organiser.",
  "home.faq.cost.q": "Ça coûte quelque chose ?",
  "home.faq.cost.a":
    "Pas pour s'engager : ton dépôt t'est rendu. Pour créer une chasse, oui : la caution n'est pas rendue en entier. Une partie paie les participants si l'action a lieu, et une petite partie revient à Huntited, ce qui finance le développement et l'hébergement du service.",
  "home.create": "Créer une chasse",
  "home.search": "Rechercher une chasse…",
  "home.filter": "Filtrer par statut",
  "home.filter.all": "Toutes",
  "home.filter.active": "En cours",
  "home.filter.activated": "Déclenchées",
  "home.filter.expired": "Terminées",
  "home.section.all": "Toutes les chasses",
  "home.section.active": "Chasses en cours",
  "home.section.activated": "Chasses déclenchées",
  "home.section.expired": "Chasses terminées",
  "home.section.results": "Résultats",
  "home.loadError": "Impossible de charger les chasses pour le moment. Réessaie plus tard.",
  "home.noMatch": "Aucune chasse ne correspond à ces filtres.",
  "home.empty": "Aucune chasse pour le moment. Lance la première !",
  "home.card.before": "avant le {date}",
  "home.card.progress": "{count} sur {threshold} engagés",
  "home.card.hidden": "Seuil : {threshold} · progression masquée",

  // Compte à rebours
  "countdown.expired": "Expiré",
  "countdown.days": "j",

  // Page d'une chasse
  "hunt.loadError": "Impossible de charger la chasse. Réessaie plus tard.",
  "hunt.notFound.title": "Chasse introuvable",
  "hunt.notFound.text": "La chasse que tu cherches n'existe pas ou a été supprimée.",
  "hunt.location": "Lieu",
  "hunt.deadline": "Date limite",
  "hunt.threshold": "Seuil",
  "hunt.thresholdValue": "{count} participants",
  "hunt.commitDeposit": "Dépôt d'engagement (rendu à la fin)",
  "hunt.caution": "Caution du créateur",
  "hunt.progress.label": "Participants engagés",
  "hunt.progress.of": "sur {threshold} requis",
  "hunt.progress.retained":
    "Groupe retenu : {count} (les autres attendent que leur propre condition soit remplie)",
  "hunt.progress.hidden": "Progression masquée",
  "hunt.progress.hiddenText":
    "Seuil : {threshold} participants. Le nombre d'engagés sera révélé au déclenchement ou à la date limite.",
  "hunt.cta.closed": "Engagements fermés",
  "hunt.cta.committed": "Déjà engagé·e",
  "hunt.cta.commit": "S'engager — {amount} KAS",
  "hunt.condition": "Ta condition : au moins {count} personnes —",
  "hunt.condition.met": "remplie, tu fais partie du groupe.",
  "hunt.condition.pending":
    "en attente. Si elle n'est pas remplie, tes {amount} KAS te sont rendus.",
  "hunt.banner.activated":
    "Cette chasse a atteint son seuil ({count} / {threshold}) : l'action aura lieu.",
  "hunt.banner.stillOpen":
    "Les engagements restent ouverts jusqu'à la date limite : le groupe peut encore grandir.",
  "hunt.banner.expired":
    "Cette chasse est expirée sans avoir atteint son seuil ({count} / {threshold}).",
  "hunt.chat.title": "Chat de coordination",
  "hunt.chat.expired":
    "Cette chasse a expiré avant d'atteindre son seuil : aucun chat n'a été ouvert.",
  "hunt.chat.later": "Le chat s'ouvrira si le seuil est atteint.",

  // Fenêtre d'engagement
  "common.cancel": "Annuler",
  "commit.title": "Engagement de {amount} KAS",
  "commit.already": "Tu es déjà engagé·e dans cette chasse.",
  "commit.testNote": "Version de test : aucun vrai KAS n'est utilisé.",
  "commit.personal.before": "Je viens si au moins",
  "commit.personal.after": "personnes viennent",
  "commit.personal.help":
    "Facultatif. Laisse {threshold} si tu viens dès que la chasse se déclenche. Si tu mets plus et que ce nombre n'est pas atteint, tu ne viens pas et tes {amount} KAS te sont rendus. Personne d'autre ne voit ce chiffre.",
  "commit.personal.invalid": "Indique un nombre entier d'au moins {threshold}.",
  "commit.keyTerms": "Conditions clés",
  "commit.fullTerms": "Voir les conditions complètes",
  "commit.accept":
    "J'ai compris que mon dépôt reste bloqué jusqu'au déclenchement ou à la date limite de la chasse.",
  "commit.needPass": "Il te faut un pass Huntited pour t'engager (une personne = un engagement).",
  "commit.getPass": "Obtenir mon pass",
  "commit.submitting": "Engagement… (preuve en cours)",
  "commit.confirm": "Confirmer l'engagement",

  // Résolution
  "settle.title": "Résolution",
  "settle.notYet":
    "La résolution n'est pas encore disponible : elle aura lieu quand le seuil sera atteint ou à la date limite.",
  "settle.done": "Résolution (effectuée)",
  "settle.simulation": "Résolution (simulation)",
  "settle.success": "Succès",
  "settle.failure": "Échec",
  "settle.refund": "Remboursement par engagé·e",
  "settle.reward": "Récompense par engagé·e",
  "settle.creatorRefund": "Caution rendue au créateur",
  "settle.nonRetained": "Remboursement par non-retenu·e ({count})",
  "settle.noTransfer": "Simulation locale — aucun KAS transféré.",
  "settle.simulate": "Simuler le règlement",

  // Chat
  "chat.checking": "Vérification de l'accès…",
  "chat.connect":
    "Connecte ton wallet pour accéder au chat (réservé au créateur et aux engagé·es).",
  "chat.forbidden":
    "Le chat est réservé à la personne qui a créé la chasse et aux engagé·es retenu·es (dont la condition est remplie).",
  "chat.unavailable": "Le chat est temporairement indisponible.",
  "chat.signatureRefused":
    "Signature refusée : signe le message dans ton wallet pour accéder au chat.",
  "chat.expiredOn": "Le salon a expiré le {date}.",
  "chat.neverOpened": "Aucun salon n'a été ouvert pour cette chasse.",
  "chat.open": "Le chat est ouvert. Rejoins-le pour coordonner l'action.",
  "chat.openLink": "Ouvrir le chat Matrix",
  "chat.expiresOn": "Expire le {date}",
  "notify.follow": "Me prévenir du résultat",
  "notify.on": "Tu seras prévenu·e (annuler)",
  "notify.hint": "Une notification quand la chasse se déclenche ou échoue.",
  "notify.denied":
    "Les notifications sont bloquées pour ce site : autorise-les dans les réglages du navigateur.",
  "notify.unavailable": "Les notifications ne sont pas disponibles pour le moment.",
  "chat.opening": "La chasse est déclenchée : ouverture du chat…",
  "common.retry": "Réessayer",
  "chat.demo": "(Démonstration : chat simulé, aucun salon réel)",
  "chatLogin.title": "Tes identifiants pour ce chat",
  "chatLogin.step1": "Ouvre le chat avec le bouton ci-dessus (application Element).",
  "chatLogin.step2": "Connecte-toi avec l'identifiant et le mot de passe ci-dessous.",
  "chatLogin.username": "Identifiant",
  "chatLogin.password": "Mot de passe",
  "chatLogin.copy": "Copier",
  "chatLogin.copied": "Copié.",
  "chatLogin.show": "Afficher",
  "chatLogin.hide": "Masquer",
  "chatLogin.note":
    "Compte temporaire, réservé à cette chasse et sans lien avec ton wallet. Il est supprimé avec le salon, 24 h après la date limite. Les messages sont chiffrés de bout en bout.",

  // Partage et X
  "share.share": "Partager",
  "share.copied": "Lien copié.",
  "share.copiedShort": "Lien copié",
  "share.copyFailed": "Impossible de copier le lien. Copie l'adresse de la page.",
  "x.reply": "Répondre à un tweet",
  "x.tweetUrl": "Adresse du tweet",
  "x.invalid": "Colle l'adresse d'un tweet, par exemple https://x.com/nom/status/123…",
  "x.help":
    "X s'ouvre avec une réponse déjà rédigée et le lien de la chasse. Tu peux la modifier avant de publier, depuis ton compte.",
  "x.open": "Ouvrir la réponse sur X",

  // Badges
  "badges.title": "Mes badges",
  "badges.lead": "Des récompenses symboliques : elles ne changent jamais les montants en KAS.",
  "badges.none": "Pas encore de badge.",
  "badges.locked": "À débloquer ({count})",
  "badges.public": "Badges visibles publiquement",
  "badges.publicHelp":
    "Réglage propre à ce wallet. Désactivé, tes badges ne sont visibles que par toi : ils pourraient sinon révéler les chasses auxquelles tu as participé. Aucun profil public n'existe encore dans ce prototype ; ce choix sera appliqué dès qu'il y en aura un.",
  "badge.tier.bronze": "bronze",
  "badge.tier.argent": "argent",
  "badge.tier.or": "or",
  "badge.pionnier.name": "Pionnier·ère",
  "badge.pionnier.text": "Parmi les 10 % premiers engagés d'une chasse qui a réussi.",
  "badge.declencheur.name": "Déclencheur·se",
  "badge.declencheur.text": "Ton engagement a fait franchir le seuil d'une chasse.",
  "badge.habitue.name": "Habitué·e",
  "badge.habitue.text": "Engagé·e dans 1, 5 puis 25 chasses réussies (bronze, argent, or).",
  "badge.serie.name": "Série",
  "badge.serie.text": "Engagé·e au moins une fois par mois, 3 mois de suite.",
  "badge.perseverant.name": "Persévérant·e",
  "badge.perseverant.text": "Engagé·e dans 3 chasses qui n'ont pas atteint leur seuil.",
  "badge.batisseur.name": "Bâtisseur·se",
  "badge.batisseur.text": "Tu as créé une chasse qui a réussi.",
  "badge.rassembleur.name": "Rassembleur·se",
  "badge.rassembleur.text": "Tu as créé une chasse réussie avec au moins 50 engagés.",
  "badge.visionnaire.name": "Visionnaire",
  "badge.visionnaire.text": "Tu as créé une chasse réussie à progression masquée.",
  "badge.messager.name": "Messager·ère",
  "badge.messager.text": "Tu as partagé une chasse qui a ensuite réussi.",

  // Création
  "create.title": "Créer une chasse",
  "create.lead":
    "Définis l'action collective et le seuil de participants. Aucun organisateur central : la chasse se déclenche d'elle-même quand le seuil est atteint.",
  "form.title": "Titre",
  "form.title.placeholder": "Ex. Rassemblement place de la République",
  "form.description": "Description",
  "form.description.placeholder": "Décrivez l'action collective en quelques lignes.",
  "form.location.placeholder": "Ex. Paris, place de la République",
  "form.location.help":
    "Tape une ville pour la choisir dans la liste (le pays se remplit tout seul), puis précise si besoin. La recherche se fait sur ton appareil.",
  "form.deadline": "Date et heure limite",
  "form.deadline.help": "Seuil pas atteint à cette date : action annulée.",
  "form.threshold": "Seuil de participants",
  "form.threshold.placeholder": "Ex. 50",
  "form.threshold.help": "Personnes nécessaires pour que l'action ait lieu. Minimum {min}.",
  "form.hide": "Masquer la progression",
  "form.hide.help":
    "Personne ne voit le nombre d'engagés avant la fin. (Version de test : caché à l'écran seulement.)",
  "form.hide.recommended":
    "Recommandé : sans compteur visible, personne n'attend de voir les autres pour se lancer, et s'engager le premier n'expose pas.",
  "form.caution": "Ta caution",
  "form.caution.label": "Ta caution (KAS)",
  "form.caution.success": "Action réussie :",
  "form.caution.successText":
    "jusqu'à {cap} par engagé ({pool} au plus), {fee} à Huntited, le reste t'est rendu.",
  "form.caution.failure": "Action annulée :",
  "form.caution.why":
    "Ta caution n'est donc pas rendue en entier : elle paie les participants et Huntited, ce qui finance le développement et l'hébergement du service.",
  "form.caution.failureText": "{fee} à Huntited, {refund} te sont rendus.",
  "form.caution.min":
    "Minimum {min} KAS. Une caution plus élevée récompense davantage les engagés.",
  "form.commitDeposit": "Dépôt d'engagement (par participant)",
  "form.commitDeposit.help": "Rendu au participant à la fin, que l'action réussisse ou non.",
  "form.draftError": "Impossible d'enregistrer le brouillon. Réessaie.",
  "form.submit": "Vérifier ma chasse",
  "val.title.required": "Le titre est requis.",
  "val.title.long": "Le titre ne doit pas dépasser 80 caractères.",
  "val.placeholder": "Remplace les passages [entre crochets] par tes informations.",
  "data.title": "Tes données",
  "data.lead":
    "Huntited n'a pas de compte : presque tout reste dans ton navigateur. Voici exactement ce qu'il garde, et ce que sait le serveur.",
  "data.device": "Sur cet appareil",
  "data.empty": "Rien pour l'instant.",
  "data.bytes": "{n} octets",
  "data.kb": "{n} Ko",
  "data.show": "Voir le contenu",
  "data.secret": "Contenu secret, non affiché. Il est inclus dans l'export.",
  "data.group.wallet": "Connexion du wallet",
  "data.group.wallet.text": "Pour te reconnecter sans tout refaire. Ton adresse ne sort pas d'ici.",
  "data.group.pass": "Ton pass",
  "data.group.pass.text":
    "Le secret qui prouve que tu as été invité·e. Si tu le perds, il faudra une nouvelle invitation.",
  "data.group.hunts": "Tes chasses et engagements",
  "data.group.hunts.text":
    "Les chasses que tu as créées ou rejointes, et ton seuil personnel, pour les retrouver dans « Mes chasses ».",
  "data.group.draft": "Brouillon",
  "data.group.draft.text": "La chasse que tu étais en train de créer.",
  "data.group.notify": "Chasses suivies",
  "data.group.notify.text": "Les chasses pour lesquelles tu as demandé à être prévenu·e.",
  "data.group.prefs": "Préférences",
  "data.group.prefs.text": "Langue, thème et affichage des badges.",
  "data.group.demo": "Démonstration",
  "data.group.demo.text": "Chasses de démonstration, quand le site tourne sans serveur.",
  "data.group.other": "Autres",
  "data.group.other.text": "Données techniques de Huntited.",
  "data.export": "Exporter",
  "data.export.note":
    "L'export est un fichier JSON créé sur ton appareil. Il contient le secret de ton pass : garde-le pour toi.",
  "data.erase": "Tout effacer",
  "data.erase.title": "Effacer les données de cet appareil ?",
  "data.erase.text":
    "Ton pass, tes chasses suivies et tes préférences seront supprimés de ce navigateur. Tes engagements, eux, restent valables : ils sont sur le serveur. Exporte d'abord si tu veux garder ton pass.",
  "data.erase.confirm": "Effacer",
  "data.server": "Sur le serveur",
  "data.server.hunts": "Les chasses elles-mêmes, publiques : titre, lieu, date, seuil.",
  "data.server.commits":
    "Pour chaque engagement, une empreinte propre à la chasse, qui ne permet pas de retrouver ton wallet. Effacée 24 h après une chasse ratée.",
  "data.server.never": "Jamais ton adresse de wallet en clair, ton IP, ton nom ou ton e-mail.",
  "data.server.more": "Le détail dans la politique de vie privée",
  "footer.data": "Tes données",
  "tpl.title": "Besoin d'un point de départ ?",
  "tpl.applied": "Exemple « {name} » chargé. Remplace ce qui est [entre crochets].",
  "tpl.why": "Conseillé pour cet exemple : {why}",
  "tpl.undo": "Annuler",
  "val.description.required": "La description est requise.",
  "val.description.long": "La description ne doit pas dépasser 1000 caractères.",
  "val.location.required": "Le lieu est requis.",
  "val.deadline.required": "La date limite est requise.",
  "val.deadline.invalid": "La date limite n'est pas valide.",
  "val.deadline.past": "La date limite doit être dans le futur.",
  "val.threshold.positive": "Le seuil doit être un nombre strictement positif.",
  "val.threshold.integer": "Le seuil doit être un nombre entier.",
  "val.threshold.min": "Le seuil doit être d'au moins {min} personnes.",
  "val.threshold.max": "Le seuil est trop élevé.",
  "val.caution.min": "La caution doit être un nombre entier d'au moins {min} KAS.",
  "val.caution.max": "La caution est trop élevée.",

  // Récapitulatif
  "review.title": "Récapitulatif de ta chasse",
  "review.lead":
    "Vérifie les informations. Une fois créée, la chasse ne pourra plus être modifiée.",
  "review.progress": "Progression",
  "review.hidden": "Masquée jusqu'à la fin",
  "review.visible": "Visible par tous",
  "review.needWallet":
    "Connecte ton wallet pour créer la chasse : il t'identifie comme créateur·rice et te permettra d'ouvrir le chat une fois le seuil atteint.",
  "review.back": "Retour",
  "review.creating": "Création en cours…",
  "review.confirm": "Confirmer et créer la chasse",
  "review.createError": "Une erreur est survenue lors de la création de la chasse. Réessaie.",

  // Mon pass
  "pass.lead":
    "Le pass prouve que tu es une vraie personne : une personne = un engagement par chasse. Il reste sur cet appareil ; Huntited ne sait jamais qui tu es ni à quelles chasses tu participes.",
  "pass.unavailable":
    "Les pass fonctionnent avec le registre partagé : ils ne sont pas disponibles dans ce mode de démonstration.",
  "pass.join.title": "Rejoindre avec une invitation",
  "pass.join.text":
    "Un membre te l'envoie (par exemple sur Signal). Chaque invitation ne sert qu'une fois.",
  "pass.join.label": "Code ou lien d'invitation",
  "pass.create": "Créer mon pass",
  "pass.creating": "Création…",
  "pass.created": "Ton pass est créé.",
  "pass.active": "Ton pass est actif sur cet appareil.",
  "pass.invite.title": "Inviter quelqu'un",
  "pass.invite.textOne":
    "Invite seulement des personnes que tu connais : chaque invitation crée un pass. Il te reste {count} invitation ce mois-ci.",
  "pass.invite.textMany":
    "Invite seulement des personnes que tu connais : chaque invitation crée un pass. Il te reste {count} invitations ce mois-ci.",
  "pass.invite.link": "Lien d'invitation",
  "pass.invite.copy": "Copier le lien",
  "pass.invite.copyFailed": "Copie impossible : sélectionne le lien.",
  "pass.invite.help":
    "Envoie-le par une messagerie chiffrée (Signal). Valable 7 jours, pour une seule personne.",
  "pass.invite.create": "Créer une invitation",
  "pass.invite.proving": "Preuve en cours…",
  "pass.backup.title": "Sauvegarder ou retirer mon pass",
  "pass.backup.text":
    "Sans sauvegarde, ton pass est perdu si tu changes de téléphone ou effaces les données du site. Garde ce code pour toi : qui l'a peut s'engager à ta place.",
  "pass.backup.code": "Code de sauvegarde",
  "pass.remove": "Retirer le pass de cet appareil",
  "pass.remove.confirm": "Retirer le pass de cet appareil ? Sans sauvegarde, il est perdu.",
  "pass.restore.title": "J'ai déjà un pass (restaurer une sauvegarde)",
  "pass.restore.code": "Code de sauvegarde à restaurer",
  "pass.restore": "Restaurer",
  "pass.restored": "Pass restauré.",
  "pass.err.generic": "L'opération a échoué. Réessaie.",
  "pass.err.noPass": "Aucun pass sur cet appareil.",
  "pass.err.badBackup": "Sauvegarde de pass invalide.",
  "pass.err.unknown": "Ce pass n'est pas enregistré.",
  "pass.err.alreadyHere": "Cet appareil a déjà un pass.",
  "pass.err.invalidInvitation": "Invitation invalide, expirée ou déjà utilisée.",
  "pass.err.alreadyMember": "Ce pass est déjà enregistré.",
  "pass.err.createFailed": "Impossible de créer le pass. Réessaie.",
  "pass.err.inviteFailed": "Impossible de créer l'invitation. Réessaie.",
  "pass.err.noInvitesLeft": "Tu as utilisé toutes tes invitations ce mois-ci.",

  // Mes chasses
  "my.connect": "Connecte ton wallet pour voir les chasses que tu as créées.",
  "my.lead": "Les chasses créées avec ce wallet.",
  "my.leadLocal": "Les chasses créées avec ce wallet, sur cet appareil.",
  "my.syncText":
    "Tu as utilisé ce wallet sur un autre appareil ? Récupère tes chasses et tes engagements (une signature, aucun KAS).",
  "my.sync": "Synchroniser",
  "my.syncing": "Synchronisation…",
  "my.synced": "Synchronisé : {created} chasse(s) créée(s), {commitments} engagement(s).",
  "my.syncFailed": "La synchronisation a échoué.",
  "my.noHunts": "Tu n'as pas encore créé de chasse.",
  "my.threshold": "seuil {threshold}",
  "my.commitments": "Mes engagements",
  "my.noCommitments": "Aucun engagement pour l'instant.",

  // Encadré du créateur
  "creator.title": "C'est ta chasse : fais-la connaître",
  "creator.text":
    "Une chasse ne se déclenche que si assez de monde est au courant. Partage le lien là où ton action compte.",
  "creator.tip1": "Envoie-le dans tes groupes (Signal, WhatsApp, Telegram…).",
  "creator.tip2": "Réponds aux tweets qui parlent du sujet avec « Répondre à un tweet ».",
  "creator.tip3":
    "Rappelle que s'engager ne coûte rien : le dépôt est rendu, et une récompense est versée si l'action a lieu.",

  // Pays
  "form.country": "Pays",
  "form.country.placeholder": "Choisis un pays",
  "val.country.required": "Le pays est requis.",
  "home.country": "Filtrer par pays",
  "home.country.withHunts": "Avec des chasses",
  "home.country.others": "Autres pays",
  "home.country.all": "Tous les pays",
  "hunt.country": "Pays",
  "city.suggestions": "Villes suggérées",
  "city.population": "{count} hab.",
  "footer.geonames": "Villes : GeoNames (CC BY 4.0)",
  "footer.legal": "Conditions, vie privée et charte",
  "legal.title": "Conditions, vie privée et charte",
  "legal.updated": "Mise à jour : {date}",
  "legal.draft":
    "Version de test : ce texte est provisoire et sera relu avant l'ouverture au public. Les éléments entre crochets seront complétés à la mise en ligne.",
  "legal.toc": "Sommaire",
  "commit.legalLink": "Conditions d'utilisation et vie privée",

  // Cartes, sections, étapes
  "card.endsIn": "Se termine {when}",
  "card.ended": "Terminée {when}",
  "my.created": "Chasses créées",
  "my.browse": "Voir les chasses",
  "pass.step1": "Un membre t'envoie une invitation (par exemple sur Signal).",
  "pass.step2": "Tu crées ton pass : il reste sur ton téléphone, sans nom ni adresse.",
  "pass.step3":
    "Pour t'engager, ton téléphone prouve que tu as un pass, sans dire lequel : une personne = un engagement.",
  "form.section.action": "L'action",
  "form.section.people": "Les participants",
  "form.section.money": "Les dépôts",

  // Erreurs (wallet, actions)
  "wallet.err.noKastle": "Extension Kastle introuvable. Installe-la puis recharge la page.",
  "wallet.err.refused": "Connexion refusée dans Kastle.",
  "wallet.err.network": "Passe Kastle sur le réseau testnet-10 pour continuer.",
  "wallet.err.noAccount": "Aucun compte disponible dans Kastle.",
  "wallet.err.accountChanged": "Le compte Kastle a changé pendant la connexion. Réessaie.",
  "wallet.err.notConnected": "Wallet non connecté.",
  "wallet.err.generic": "Connexion au wallet impossible. Réessaie.",
  "err.signature": "Signature refusée : signe le message dans ton wallet pour continuer.",
  "err.unavailable": "Le service est temporairement indisponible. Réessaie.",
  "err.create": "La création de la chasse a échoué. Réessaie.",
  "err.commit": "L'engagement a échoué. Réessaie.",
  "err.sync": "La synchronisation a échoué. Réessaie.",
  "err.needPass":
    "Il te faut un pass Huntited pour t'engager : demande une invitation à un membre.",
} as const;

export type Messages = Record<keyof typeof fr, string>;
