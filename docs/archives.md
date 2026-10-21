# Archives du registre

**Le problème.** Les nœuds Kaspa effacent les vieux blocs (environ 30 heures
d'historique). L'API publique du réseau de test a ainsi été réinitialisée en
octobre 2026 : elle ne listait plus aucune transaction du registre, et les
chasses en cours avaient disparu de l'affichage. Une chasse dure souvent plus
longtemps que cette fenêtre.

**La solution : des archives.** Une archive est un fichier JSON qui garde
chaque transaction finale du registre, telle que la chaîne l'a acceptée. Le
site (et l'index du serveur) rejoue les archives puis l'API : même ordre, même
résultat que si l'API avait tout gardé (`ChainIndexer.seed`, testé dans
`backend/src/chain/indexer.test.ts` et `src/lib/onchain/browser-index.test.ts`).

```json
{
  "format": "huntited-registry-archive",
  "version": 1,
  "registry": "kaspatest:qr2ck8…",
  "entries": [
    { "txId": "…", "score": 591178395, "time": 1792610368460, "sender": "kaspatest:…", "payload": "484e5431…" }
  ]
}
```

Une archive ne fait que grandir : `scripts/archive-registry.mjs` fusionne les
archives existantes avec ce que l'API liste encore, sans jamais rien retirer.

## Les trois copies

1. **Archive livrée avec le site** : `registry-snapshot.json`, produite par
   `npm run build:static`. Elle fait partie du manifest, donc de la version
   ancrée par huntited.kas : on ne peut pas la modifier sans casser la
   vérification.
2. **Archive en ligne** : `https://huntited.codeberg.page/registry-live.json`,
   complétée toutes les 6 heures par `.github/workflows/archive.yml` (secret
   GitHub `CODEBERG_TOKEN`) et à chaque `npm run publish:codeberg`.
3. **Historique git** du dépôt `Huntited/pages` sur Codeberg : chaque mise à
   jour de l'archive y est un commit.

Le site lit les archives listées dans `VITE_CHAIN_ARCHIVES` (par défaut, en
version statique : les deux premières). Une archive absente est ignorée.

## Limites (à traiter)

- **Confiance** : une transaction plus vieille que la fenêtre de l'API ne peut
  plus être revérifiée sur la chaîne. Le site fait confiance aux archives qu'il
  liste lui-même (celle qu'il embarque est couverte par l'ancrage). Ajouter des
  archives tenues par d'autres personnes demandera un accord entre plusieurs
  sources avant d'accepter une transaction.
- **Ce qui est perdu reste perdu** : les transactions oubliées par l'API avant
  la première archive (chasses de test d'octobre 2026) ne reviendront pas.

N'importe qui peut tenir sa propre archive :

```bash
npm run archive:registry -- --out registry.json --from registry.json
```
