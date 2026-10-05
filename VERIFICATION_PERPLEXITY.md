# Huntited — demande de vérification externe

> **À Perplexity :** merci de vérifier ce qui suit de façon critique, en t'appuyant sur des **sources publiques citées** (code source GitHub, documentation officielle). Pour chaque question, réponds par **Confirmé / Faux / Incertain**, avec la source et, si c'est faux, la correction précise. Ne suppose rien que tu ne peux pas sourcer : dis « Incertain » le cas échéant.

---

## 1. Contexte

Huntited est un prototype de protocole de coordination d'actions collectives sur **Kaspa** : une « chasse » s'active si un seuil d'engagements est atteint avant une date limite.

- Front : React + TypeScript + TanStack Router + Tailwind (Vite).
- Backend : Express (accès au chat, en mode mock).
- Chat prévu : Matrix auto-hébergé (actuellement simulé).
- **État actuel :** tout est simulé (mock), **sauf** la connexion au wallet, qui peut désormais utiliser la vraie extension **Kastle** sur le **testnet**.

### Règles imposées (ne doivent pas être enfreintes)

- **Aucune transaction KAS réelle** pour l'instant : uniquement connexion du wallet et signature de message.
- **Jamais mainnet** pendant la phase de test : uniquement testnet.
- Privacy-first : aucune adresse complète, secret, token ou signature dans les logs.
- Économie MVP (inchangée, voir §4).

---

## 2. Ce qui a été fait

1. **Validation du projet** : installation des outils, `lint`, `test` et `build` passent.
   - lint : 0 erreur (8 avertissements `react-refresh` sans gravité)
   - tests : 7 fichiers, 43 tests passent (front) ; 2 fichiers, 13 tests (backend)
   - build : OK ; `tsc --noEmit` : 0 erreur
2. **Wallet obligatoire pour créer une chasse** : sans wallet connecté, la page de confirmation propose « Connecter le wallet » au lieu de « Confirmer », et la création refuse de s'exécuter sans adresse. Raison : sinon la chasse n'a pas de créateur et personne ne peut ouvrir son chat.
3. **Intégration de l'extension Kastle** (connexion + signature uniquement, testnet-10).

---

## 3. Intégration Kastle — à vérifier en priorité

### 3.1 API Kastle utilisée

D'après `docs/kastle-api.md` et `api/browser.ts` du dépôt `github.com/forbole/kastle` (lus le 5 octobre 2026) :

| Méthode / événement | Signature supposée |
|---|---|
| détection | `window.kastle` défini |
| `connect()` | `Promise<boolean>` |
| `disconnect()` | `Promise<void>` |
| `getAccount()` | `Promise<{ address: string; publicKey: string }>` |
| `getNetwork()` | `Promise<string>` |
| `switchNetwork(id)` | `id: "mainnet" \| "testnet-10"` → `Promise<string>` |
| `signMessage(message)` | `Promise<string>` (signature) |
| événement `kas:account_changed` | payload `string \| null` |
| événement `kas:network_changed` | payload `string` |

### 3.2 Questions

1. Ces signatures sont-elles exactes dans la version actuelle de Kastle ?
2. `"testnet-10"` est-il bien l'identifiant actuel du testnet Kaspa utilisable avec Kastle ? (La doc mentionne aussi `"testnet-11"`, mais le type de `switchNetwork` ne l'accepte pas.) Quel est le statut actuel de testnet-11 par rapport à testnet-10 ? Est-il encore recommandé pour le développement d'applications, ou réservé à des tests spécifiques du protocole ?
3. `connect()` affiche-t-il une fenêtre d'autorisation à l'utilisateur ? Que renvoie-t-il, ou que lève-t-il, en cas de refus ?
4. `getNetwork()` et `getAccount()` fonctionnent-ils **avant** `connect()`, ou lèvent-ils une erreur ? (Le code appelle `getNetwork()` + `getAccount()` au rechargement pour revalider une session restaurée.)
5. `switchNetwork()` demande-t-il une confirmation à l'utilisateur ?
6. Le payload de `kas:account_changed` vaut-il bien `null` quand le wallet est verrouillé ou déconnecté ?
7. Quel est le **format exact** de la signature renvoyée par `signMessage()` (schnorr ? ECDSA ? préfixe de message ? encodage hex ?) et comment la **vérifier côté serveur** (Node.js) avec la clé publique de `getAccount()` ? Existe-t-il une bibliothèque Kaspa officielle pour cela (ex. `kaspa-wasm` / `rusty-kaspa`) ?
8. Les adresses testnet commencent-elles bien par `kaspatest:` ?

### 3.3 Code (src/lib/wallet.ts)

```ts
// Wallet Kaspa, choisi selon VITE_WALLET_MODE :
//   "mock"   → adresse factice générée localement (par défaut, tests)
//   "kastle" → extension Kastle (window.kastle), testnet uniquement
// Aucun envoi de KAS : seules la connexion et la signature de message sont utilisées.

const STORAGE_KEY = "huntited:mock-wallet";
const isBrowser = () => typeof window !== "undefined";

export const KASTLE_NETWORK = "testnet-10";
export type WalletMode = "mock" | "kastle";

export function getWalletMode(): WalletMode {
  return import.meta.env["VITE_WALLET_MODE"] === "kastle" ? "kastle" : "mock";
}

export interface WalletState { isConnected: boolean; address: string | null; }
export class WalletError extends Error {}

interface KastleProvider {
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  getAccount(): Promise<{ address: string; publicKey: string }>;
  getNetwork(): Promise<string>;
  switchNetwork(networkId: "mainnet" | "testnet-10"): Promise<string>;
  signMessage(message: string): Promise<string>;
  on(event: "kas:account_changed", handler: (address: string | null) => void): unknown;
  on(event: "kas:network_changed", handler: (network: string) => void): unknown;
}

function getKastle(): KastleProvider | undefined {
  return isBrowser() ? (window as unknown as { kastle?: KastleProvider }).kastle : undefined;
}
function requireKastle(): KastleProvider {
  const kastle = getKastle();
  if (!kastle) throw new WalletError("Extension Kastle introuvable. Installe-la puis recharge la page.");
  return kastle;
}

const DISCONNECTED: WalletState = { isConnected: false, address: null };
const listeners = new Set<(s: WalletState) => void>();
let state: WalletState = DISCONNECTED;
let loaded = false;
let kastleBound = false;

function load(): WalletState {
  if (loaded || !isBrowser()) return state;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as WalletState) : null;
    state = parsed?.isConnected && parsed.address ? parsed : DISCONNECTED;
  } catch { state = DISCONNECTED; }
  return state;
}

function setState(next: WalletState) {
  state = next;
  if (isBrowser()) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  listeners.forEach((fn) => fn(state));
}

// Suit compte / verrouillage / réseau ; revalide une session restaurée.
function bindKastle() {
  if (kastleBound || getWalletMode() !== "kastle") return;
  const kastle = getKastle();
  if (!kastle) return;
  kastleBound = true;
  kastle.on("kas:account_changed", (address) => {
    if (!load().isConnected) return;
    setState(address ? { isConnected: true, address } : DISCONNECTED);
  });
  kastle.on("kas:network_changed", (network) => {
    if (network !== KASTLE_NETWORK && load().isConnected) setState(DISCONNECTED);
  });
  if (load().isConnected) {
    void Promise.all([kastle.getNetwork(), kastle.getAccount()])
      .then(([network, account]) => setState(
        network === KASTLE_NETWORK && account.address
          ? { isConnected: true, address: account.address } : DISCONNECTED))
      .catch(() => setState(DISCONNECTED));
  }
}

async function connectKastle(): Promise<string> {
  const kastle = requireKastle();
  bindKastle();
  try {
    let connected: boolean;
    try { connected = await kastle.connect(); } catch { connected = false; }
    if (!connected) throw new WalletError("Connexion refusée dans Kastle.");
    try {
      if ((await kastle.getNetwork()) !== KASTLE_NETWORK) await kastle.switchNetwork(KASTLE_NETWORK);
    } catch {
      throw new WalletError(MSG_WRONG_NETWORK);
    }
    // Relecture finale : réseau et compte doivent être valides ensemble.
    const [network, account] = await Promise.all([kastle.getNetwork(), kastle.getAccount()]);
    if (network !== KASTLE_NETWORK) throw new WalletError(MSG_WRONG_NETWORK);
    if (!account.address) throw new WalletError("Aucun compte disponible dans Kastle.");
    setState({ isConnected: true, address: account.address });
    return account.address;
  } catch (e) {
    setState(DISCONNECTED);   // aucun état partiel en cas d'échec
    throw e;
  }
}

export async function connectWallet(): Promise<string> {
  if (getWalletMode() === "kastle") return connectKastle();
  await delay(500);
  const address = `kaspa:mock${randomHex(20)}`;   // mock
  setState({ isConnected: true, address });
  return address;
}

export function disconnectWallet(): void {
  if (getWalletMode() === "kastle") void getKastle()?.disconnect().catch(() => undefined);
  setState(DISCONNECTED);
}

export async function signMessage(message: string): Promise<string> {
  if (!load().isConnected) throw new WalletError("Wallet non connecté.");
  if (getWalletMode() === "kastle") return requireKastle().signMessage(message);
  await delay(300);
  return `mocksig_${randomHex(32)}`;              // mock
}
// (getWalletState, subscribeWallet, randomHex, delay : utilitaires sans logique Kastle)
```

Les tests (`wallet.test.ts`, 9 tests avec une fausse `window.kastle`) couvrent : extension absente, connexion refusée, connexion sur testnet-10, demande de bascule depuis mainnet, refus de rester sur mainnet, déconnexion sur changement de réseau, suivi du compte et du verrouillage, signature, **aucun appel** à `sendKaspa` / `signTx` / `signAndBroadcastTx`, revalidation d'une session restaurée.

### 3.4 Points faibles connus — ton avis est demandé

- **(a)** L'adresse complète est stockée dans `localStorage` (clé `huntited:mock-wallet`, dont le nom est hérité du mock). Acceptable pour une adresse publique, ou à éviter ?
- **(b)** Course possible : un événement `kas:account_changed` reçu pendant `connectKastle()` (avant `setState`) est ignoré, car l'état est encore « déconnecté ». Risque réel ?
- **(c)** `signMessage` n'est encore relié à rien : le backend fait toujours confiance à une adresse **déclarée**. Étape suivante prévue : défi signé (nonce + domaine + expiration) vérifié côté serveur. Quel format de message recommandes-tu pour éviter le rejeu et le phishing (équivalent Kaspa de SIWE / EIP-4361) ?
- **(d)** Le réseau est vérifié côté client uniquement. Un utilisateur pourrait-il contourner cette vérification d'une façon qui pose problème, sachant qu'aucune transaction n'est faite ?

---

## 4. Économie MVP — à vérifier (logique et arrondis)

> **Mise à jour (5 octobre 2026) :** la règle d'échec a changé depuis l'envoi
> de ce document. En cas d'échec, chaque engagé récupère ses 5 KAS **plus un
> bonus de 1 KAS** pris sur le dépôt de création du créateur (total plafonné à
> 30 KAS, partagé au-delà de 30 engagés). Voir `docs/economics.md`. La section
> ci-dessous décrit l'ancienne règle.

Règles :
- Dépôt de création : **30 KAS** ; dépôt d'engagement : **5 KAS** par engagé.
- **Succès** (seuil atteint avant la deadline) : créateur récupère 30 KAS ; les dépôts d'engagement (5 × N KAS) vont **95 % au créateur, 5 % à la treasury** ; engagés : 0 KAS.
- **Échec** : créateur récupère 30 KAS ; chaque engagé récupère 5 KAS ; treasury : 0 KAS.
- Calculs en **sompis** (`1 KAS = 100 000 000 sompis`), en `bigint`.

```ts
export const SOMPI_PER_KAS = 100_000_000n;
export const CREATE_DEPOSIT_SOMPI = 30n * SOMPI_PER_KAS;
export const COMMIT_DEPOSIT_SOMPI = 5n * SOMPI_PER_KAS;

export function calculateSettlement(commitCount: number, outcome: "success" | "failure") {
  if (!Number.isSafeInteger(commitCount) || commitCount < 0) throw new Error("Nombre d'engagements invalide.");
  const total = BigInt(commitCount) * COMMIT_DEPOSIT_SOMPI;
  if (outcome === "failure") {
    return { creatorCreationRefundSompi: CREATE_DEPOSIT_SOMPI, creatorCommitRewardSompi: 0n,
             treasurySompi: 0n, participantRefundPerCommitSompi: COMMIT_DEPOSIT_SOMPI };
  }
  const treasurySompi = total / 20n;              // 5 %
  return { creatorCreationRefundSompi: CREATE_DEPOSIT_SOMPI,
           creatorCommitRewardSompi: total - treasurySompi,   // 95 %
           treasurySompi, participantRefundPerCommitSompi: 0n };
}
```

Résultats observés dans l'application :

| Cas | Créateur | Treasury | Par engagé |
|---|---|---|---|
| Succès, 1 engagement | 30 + 4,75 KAS | 0,25 KAS | 0 |
| Succès, 2 engagements | 30 + 9,5 KAS | 0,5 KAS | 0 |
| Succès, 10 engagements | 30 + 47,5 KAS | 2,5 KAS | 0 |
| Échec, N engagements | 30 KAS | 0 | 5 KAS |

Questions :
1. Le calcul respecte-t-il exactement les règles ? La division `total / 20n` peut-elle produire un arrondi (sachant que `total` est toujours un multiple de 500 000 000 sompis) ?
2. La somme des sorties est-elle toujours égale à la somme des dépôts ?
3. **Frais de réseau Kaspa** : qui doit les payer lors du règlement réel ? Les dépôts de 5 KAS peuvent-ils poser un problème de seuil minimal ou de « dust » sur Kaspa (règle de masse de stockage, KIP-9) ?

---

## 5. Ce qui n'est PAS demandé

- Ne propose pas de passer en mainnet, ni d'envoyer de vrais KAS.
- Ne propose pas de système de contestation, d'arbitres ou de validateurs (décision produit : exclu du MVP).
- Kachat est abandonné au profit de Matrix.

## 6. Format de réponse souhaité

Pour chaque question numérotée (3.2.1 à 3.2.8, 3.4.a à 3.4.d, 4.1 à 4.3) :
**Verdict** (Confirmé / Faux / Incertain) — **Explication courte** — **Source(s) avec lien**.
