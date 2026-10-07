# Publier Huntited sans serveur (IPFS)

`npm run build:static` produit `dist-static/` : le site complet en fichiers
statiques. Registre sur la blockchain (réseau de test), index dans le
navigateur, wallet Kastle, **aucun serveur Huntited**. Navigation par « # »
(`/#/hunt/…`) et chemins relatifs : fonctionne sur un domaine, une passerelle
IPFS (`…/ipfs/<CID>/`) ou n'importe quel hébergeur de fichiers.

Sans serveur : le chat chiffré (pair à pair) et les notifications sont « à
venir » ; l'aperçu des liens sur X est générique.

## Publier

1. `npm run build:static`
2. Ajouter le dossier à IPFS (récupère un identifiant, le CID) :
   - avec Kubo : `ipfs add -r --cid-version 1 dist-static` ;
   - ou par un service d'épinglage (Filebase, Pinata, 4EVERLAND…) : envoyer
     le dossier.
3. **Épingler chez plusieurs services** (le site reste disponible si l'un
   disparaît).
4. Facultatif : copie permanente sur Arweave (ArDrive).
5. Nom de domaine : enregistrement DNS `_dnslink.huntited.org` →
   `dnslink=/ipfs/<CID>` (à refaire à chaque nouvelle version).

Vérifié localement en imitant une passerelle par chemin (`/ipfs/<CID>/`) : pages,
navigation, liste des villes et lecture de la blockchain fonctionnent.

## Versions officielles ancrées sur Kaspa

Chaque construction produit `release.json` : la liste des fichiers avec leur
empreinte (sha256) et l'empreinte de cette liste (« manifest »). Le script
affiche la version et le manifest.

1. **Adresse de publication** : une adresse Kaspa réservée à ça (compte Kastle
   « Huntited publication »). Elle doit être connue de tous les index :
   `RELEASE_PUBLISHERS=kaspatest:…` pour la construction du site
   (`RELEASE_PUBLISHERS=… npm run build:static`) et pour l'index du serveur.
2. **Ancrer** : ouvrir la page `#/publish` du site publié, connecter le compte
   de publication, indiquer l'identifiant IPFS (facultatif), puis « Ancrer ».
   Kastle envoie le message (0,2 KAS de test).
3. Le pied de page affiche alors « Version … · vérifiée sur Kaspa ».

**Vérifier un site de l'extérieur** (la vraie preuve : un faux site peut
mentir dans son propre affichage) :

```bash
npm run verify:release -- https://<passerelle>/ipfs/<CID>/ --publisher kaspatest:…
```

Le script télécharge chaque fichier, recalcule les empreintes et les compare
à la version ancrée sur la chaîne. Testé sur le réseau de test : fichiers
identiques et version officielle reconnue ; un fichier modifié est détecté.

**Plusieurs points d'accès** : `VITE_KASPA_API_URL` (et `CHAIN_API_URLS` côté
serveur) acceptent plusieurs adresses séparées par des virgules ; l'ordre est
tiré au hasard et les suivantes servent de secours.
