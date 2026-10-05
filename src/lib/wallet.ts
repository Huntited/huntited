// Wallet Kaspa, choisi selon VITE_WALLET_MODE :
//   "mock"   → adresse factice générée localement (par défaut, tests)
//   "kastle" → extension Kastle (window.kastle), testnet uniquement
// L'interface exportée est identique dans les deux modes.
// Aucun envoi de KAS : seules la connexion et la signature de message sont
// utilisées. Confidentialité : aucun log ; l'adresse ne quitte jamais l'appareil.

const STORAGE_KEY = "huntited:mock-wallet";
const isBrowser = () => typeof window !== "undefined";

/** Réseau imposé tant que l'intégration est en test : jamais mainnet. */
export const KASTLE_NETWORK = "testnet-10";

export type WalletMode = "mock" | "kastle";

export function getWalletMode(): WalletMode {
  return import.meta.env["VITE_WALLET_MODE"] === "kastle" ? "kastle" : "mock";
}

export interface WalletState {
  isConnected: boolean;
  address: string | null;
}

/** Erreur affichable telle quelle à l'utilisateur. */
export class WalletError extends Error {}

/** Sous-ensemble de l'API window.kastle utilisé ici (docs/kastle-api.md). */
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
  if (!kastle) {
    throw new WalletError("Extension Kastle introuvable. Installe-la puis recharge la page.");
  }
  return kastle;
}

const DISCONNECTED: WalletState = { isConnected: false, address: null };
const listeners = new Set<(s: WalletState) => void>();
let state: WalletState = DISCONNECTED;
let loaded = false;
let kastleBound = false;

/** Lecture paresseuse (évite tout accès à localStorage côté serveur). */
function load(): WalletState {
  if (loaded || !isBrowser()) return state;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as WalletState) : null;
    state = parsed?.isConnected && parsed.address ? parsed : DISCONNECTED;
  } catch {
    state = DISCONNECTED;
  }
  return state;
}

function setState(next: WalletState) {
  state = next;
  if (isBrowser()) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  listeners.forEach((fn) => fn(state));
}

/**
 * Suit les changements faits dans l'extension : changement de compte,
 * verrouillage, ou passage sur un autre réseau que le testnet (→ déconnexion).
 * Revalide aussi une session restaurée depuis localStorage.
 */
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
      .then(([network, account]) => {
        setState(
          network === KASTLE_NETWORK && account.address
            ? { isConnected: true, address: account.address }
            : DISCONNECTED,
        );
      })
      .catch(() => setState(DISCONNECTED));
  }
}

function randomHex(bytes: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const MSG_WRONG_NETWORK = "Passe Kastle sur le réseau testnet-10 pour continuer.";

async function connectKastle(): Promise<string> {
  const kastle = requireKastle();
  bindKastle();

  try {
    let connected: boolean;
    try {
      connected = await kastle.connect();
    } catch {
      connected = false;
    }
    if (!connected) throw new WalletError("Connexion refusée dans Kastle.");

    try {
      if ((await kastle.getNetwork()) !== KASTLE_NETWORK) {
        await kastle.switchNetwork(KASTLE_NETWORK);
      }
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
    // Aucun état partiel : tout échec laisse le wallet déconnecté.
    setState(DISCONNECTED);
    throw e;
  }
}

/** Connecte le wallet et renvoie son adresse. */
export async function connectWallet(): Promise<string> {
  if (getWalletMode() === "kastle") return connectKastle();
  await delay(500);
  const address = `kaspa:mock${randomHex(20)}`;
  setState({ isConnected: true, address });
  return address;
}

/** Déconnecte le wallet. */
export function disconnectWallet(): void {
  if (getWalletMode() === "kastle")
    void getKastle()
      ?.disconnect()
      .catch(() => undefined);
  setState(DISCONNECTED);
}

/** État courant du wallet. */
export function getWalletState(): WalletState {
  return load();
}

/** S'abonne aux changements (y compris depuis d'autres onglets). */
export function subscribeWallet(cb: (s: WalletState) => void): () => void {
  listeners.add(cb);
  cb(load());
  bindKastle();
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    loaded = false;
    cb(load());
  };
  if (isBrowser()) window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    if (isBrowser()) window.removeEventListener("storage", onStorage);
  };
}

/** Signe un message (Kastle : signature réelle ; mock : aléatoire, non vérifiable). */
export async function signMessage(message: string): Promise<string> {
  if (!load().isConnected) throw new WalletError("Wallet non connecté.");
  if (getWalletMode() === "kastle") return requireKastle().signMessage(message);
  await delay(300);
  return `mocksig_${randomHex(32)}`;
}
