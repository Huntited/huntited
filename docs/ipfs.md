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
