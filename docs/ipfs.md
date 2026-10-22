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
     le dossier. Avec Filebase : `npx ipfs-car pack dist-static --no-wrap --hidden
     --output site.car`, puis envoyer `site.car` dans un bucket avec la
     métadonnée `import: car` (API S3) ; Filebase renvoie le même CID.
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

1. **Adresse de publication** : la clé qui possède **huntited.kas** (service
   de noms de Kaspa, réseau principal) :
   `kaspa:qz0nnwepcezwrnx4fdptsg996590s78s8gay8nt9yuhdj6fwwjhfz32d3wzf9`.
   Le registre étant sur le réseau de test, on utilise l'adresse de test de
   la **même clé** :
   `kaspatest:qz0nnwepcezwrnx4fdptsg996590s78s8gay8nt9yuhdj6fwwjhfzsvt2pucp`
   (`src/lib/onchain/publisher.ts`, vérifié par
   `backend/src/chain/publisher.test.ts`). C'est la valeur par défaut partout ;
   `RELEASE_PUBLISHERS` permet de la remplacer.
2. **Ancrer** : ouvrir la page `#/publish` du site publié, connecter le compte
   de publication, indiquer l'identifiant IPFS (facultatif), puis « Ancrer ».
   Kastle envoie le message (0,2 KAS de test).
3. Le pied de page affiche alors « Version … · vérifiée sur Kaspa ».

**Vérifier un site de l'extérieur** (la vraie preuve : un faux site peut
mentir dans son propre affichage) :

```bash
npm run verify:release -- https://<passerelle>/ipfs/<CID>/
```

Le script télécharge chaque fichier, recalcule les empreintes et les compare
à la version ancrée sur la chaîne. Testé sur le réseau de test : fichiers
identiques et version officielle reconnue ; un fichier modifié est détecté.

**Plusieurs points d'accès** : `VITE_KASPA_API_URL` (et `CHAIN_API_URLS` côté
serveur) acceptent plusieurs adresses séparées par des virgules ; l'ordre est
tiré au hasard et les suivantes servent de secours.

## Adresse principale : huntited.com (Codeberg Pages)

`huntited.com` (Njalla) est servi par Codeberg Pages depuis le dépôt public
`Huntited/pages`, branche `pages`. Publier : `npm run build:static` puis
`npm run publish:codeberg` (clé dans `.env.publish`, jamais versionnée). Le
script garde l'archive du registre (`registry-live.json`, docs/archives.md) et
ajoute la redirection `www.huntited.com` → `huntited.com` (`_redirects`, réglage
de l'hébergeur, hors du manifest ancré).

DNS chez Njalla : `ANAME @ → codeberg.page`, `CNAME www → codeberg.page`, et
`TXT _git-pages-repository[.www] → https://codeberg.org/Huntited/pages.git`.
Un webhook Codeberg (Forgejo, branche `pages`) par adresse servie. Premier
déploiement d'une nouvelle adresse en `http://` (le certificat n'existe pas
encore), puis repasser le webhook en `https://`.
