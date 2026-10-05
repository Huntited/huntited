// Mock de wallet Kaspa.
// Version réelle : extension/wallet Kaspa (getAddresses, signMessage,
// sendTransaction). L'interface ci-dessous restera identique.
// Confidentialité : aucun log ; l'adresse ne quitte jamais l'appareil.

const STORAGE_KEY = "huntited:mock-wallet";
const isBrowser = () => typeof window !== "undefined";

export interface WalletState {
  isConnected: boolean;
  address: string | null;
}

const DISCONNECTED: WalletState = { isConnected: false, address: null };
const listeners = new Set<(s: WalletState) => void>();
let state: WalletState = DISCONNECTED;
let loaded = false;

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

function randomHex(bytes: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Connecte le wallet (mock : génère une adresse factice). */
export async function connectWallet(): Promise<string> {
  await delay(500);
  const address = `kaspa:mock${randomHex(20)}`;
  setState({ isConnected: true, address });
  return address;
}

/** Déconnecte le wallet. */
export function disconnectWallet(): void {
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

/** Signe un message (mock : signature aléatoire, non vérifiable). */
export async function signMessage(_message: string): Promise<string> {
  if (!load().isConnected) throw new Error("Wallet non connecté");
  await delay(300);
  return `mocksig_${randomHex(32)}`;
}
