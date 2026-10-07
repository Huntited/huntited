// Wallet Kaspa, choisi selon VITE_WALLET_MODE :
//   "mock"   → adresse factice générée localement (par défaut, tests)
//   "kastle" → extension Kastle (window.kastle), testnet uniquement
// L'interface exportée est identique dans les deux modes.
// Connexion et signature de message ; en mode « chain », envoi de messages au
// registre (0,2 KAS de test, réseau de test uniquement, avec accord dans
// Kastle). Confidentialité : aucun log ; Huntited n'affiche jamais l'adresse.

import { getLocale, translate, type MessageKey } from "./i18n";

/** Message d'erreur dans la langue active. */
const msg = (key: MessageKey) => translate(getLocale(), key);

// Simple mémoire d'interface : ce n'est JAMAIS une preuve d'identité.
const STORAGE_KEY = "huntited:wallet";
/** Ancienne clé (prototype mock), migrée à la première lecture. */
const LEGACY_STORAGE_KEY = "huntited:mock-wallet";
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
  /** Envoie des KAS (0,2 minimum) avec un message hexadécimal ; renvoie la transaction. */
  sendKaspa(
    toAddress: string,
    sompi: number,
    options?: { priorityFee?: number; payload?: string },
  ): Promise<string>;
  on(event: "kas:account_changed", handler: (address: string | null) => void): unknown;
  on(event: "kas:network_changed", handler: (network: string) => void): unknown;
}

function getKastle(): KastleProvider | undefined {
  return isBrowser() ? (window as unknown as { kastle?: KastleProvider }).kastle : undefined;
}

function requireKastle(): KastleProvider {
  const kastle = getKastle();
  if (!kastle) {
    throw new WalletError(msg("wallet.err.noKastle"));
  }
  return kastle;
}

const DISCONNECTED: WalletState = { isConnected: false, address: null };
const listeners = new Set<(s: WalletState) => void>();
let state: WalletState = DISCONNECTED;
let loaded = false;
let kastleBound = false;
/** Incrémenté à chaque événement Kastle (compte ou réseau). */
let kastleEvents = 0;

/** Lecture paresseuse (évite tout accès à localStorage côté serveur). */
function load(): WalletState {
  if (loaded || !isBrowser()) return state;
  loaded = true;
  try {
    const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy !== null) {
      if (window.localStorage.getItem(STORAGE_KEY) === null) {
        window.localStorage.setItem(STORAGE_KEY, legacy);
      }
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
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
    kastleEvents += 1;
    if (!load().isConnected) return;
    setState(address ? { isConnected: true, address } : DISCONNECTED);
  });
  kastle.on("kas:network_changed", (network) => {
    kastleEvents += 1;
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
    if (!connected) throw new WalletError(msg("wallet.err.refused"));

    try {
      if ((await kastle.getNetwork()) !== KASTLE_NETWORK) {
        await kastle.switchNetwork(KASTLE_NETWORK);
      }
    } catch {
      throw new WalletError(msg("wallet.err.network"));
    }

    // Relecture finale : réseau et compte doivent être valides ensemble.
    // Un événement Kastle reçu pendant la lecture (changement de compte ou de
    // réseau) serait ignoré, l'état étant encore déconnecté : on relit alors.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const seen = kastleEvents;
      const [network, account] = await Promise.all([kastle.getNetwork(), kastle.getAccount()]);
      if (network !== KASTLE_NETWORK) throw new WalletError(msg("wallet.err.network"));
      if (!account.address) throw new WalletError(msg("wallet.err.noAccount"));
      if (kastleEvents !== seen) continue;

      setState({ isConnected: true, address: account.address });
      return account.address;
    }
    throw new WalletError(msg("wallet.err.accountChanged"));
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

/**
 * Publie un message du registre (docs/registre-kaspa.md) : Kastle envoie
 * `sompi` à l'adresse du registre, depuis le compte connecté, avec le message
 * en hexadécimal, après accord dans sa fenêtre. Réseau de test uniquement.
 * Le wallet factice ne peut rien publier.
 */
export async function sendToRegistry(
  registryAddress: string,
  sompi: number,
  payloadHex: string,
): Promise<string> {
  if (!load().isConnected) throw new WalletError(msg("wallet.err.notConnected"));
  if (getWalletMode() !== "kastle") throw new WalletError(msg("wallet.err.needKastle"));
  if (!registryAddress.startsWith("kaspatest:")) throw new WalletError(msg("wallet.err.network"));
  const kastle = requireKastle();
  if ((await kastle.getNetwork()) !== KASTLE_NETWORK) {
    throw new WalletError(msg("wallet.err.network"));
  }
  try {
    return await kastle.sendKaspa(registryAddress, sompi, { payload: payloadHex });
  } catch {
    throw new WalletError(msg("wallet.err.sendRefused"));
  }
}

/** Signe un message (Kastle : signature réelle ; mock : aléatoire, non vérifiable). */
export async function signMessage(message: string): Promise<string> {
  if (!load().isConnected) throw new WalletError(msg("wallet.err.notConnected"));
  if (getWalletMode() === "kastle") return requireKastle().signMessage(message);
  await delay(300);
  return `mocksig_${randomHex(32)}`;
}
