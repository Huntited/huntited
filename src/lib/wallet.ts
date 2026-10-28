// Wallet Kaspa, choisi selon VITE_WALLET_MODE :
//   "mock"   → adresse factice générée localement (par défaut, tests)
//   "kastle" → au choix : wallet intégré (src/lib/builtin-wallet.ts), ou une
//              extension (Kastle : window.kastle, Kasperia : window.kasperia) ;
//              testnet uniquement
// L'interface exportée est identique dans les deux modes.
// Connexion et signature de message ; en mode « chain », envoi de messages au
// registre (0,2 KAS de test, réseau de test uniquement, avec accord dans
// l'extension). Confidentialité : aucun log ; Huntited n'affiche jamais l'adresse.

import { builtinAddress, builtinSend, hasBuiltinWallet, lockBuiltin } from "./builtin-wallet";
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

/** Wallets proposés dans la fenêtre « Connecter un wallet ». */
export type WalletChoice = "builtin" | "kastle" | "kasperia";

export interface WalletState {
  isConnected: boolean;
  address: string | null;
  /** Wallet utilisé ; absent = Kastle (sessions enregistrées avant Kasperia). */
  kind?: "builtin" | "kasperia";
}

/** Erreur affichable telle quelle à l'utilisateur. */
export class WalletError extends Error {}

/** Ni wallet intégré ni extension : il faut d'abord créer un wallet (page /wallet). */
export class NeedWalletError extends WalletError {}

/** Utilise le wallet intégré de cet appareil. */
export function connectBuiltin(): string {
  const address = builtinAddress("kaspatest");
  if (!address) throw new NeedWalletError(msg("wallet.err.needWallet"));
  setState({ isConnected: true, address, kind: "builtin" });
  return address;
}

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

/** Sous-ensemble de l'API window.kasperia (https://kasperia-doc.github.io/docs.html). */
interface KasperiaProvider {
  requestAccounts(): Promise<string[]>;
  getAccounts(): Promise<string[]>;
  getNetwork(): Promise<string>;
  switchNetwork(network: "mainnet" | "testnet-10"): Promise<unknown>;
  /** Montant en sompi (texte) ; renvoie l'identifiant de la transaction. */
  sendKaspa(to: string, sompi: string, options?: { payload?: string }): Promise<unknown>;
  on(event: "accountsChanged", handler: (accounts: string[]) => void): unknown;
  on(event: "networkChanged", handler: (network: string) => void): unknown;
  request?(args: { method: string; params?: unknown }): Promise<unknown>;
}

function getKasperia(): KasperiaProvider | undefined {
  return isBrowser() ? (window as unknown as { kasperia?: KasperiaProvider }).kasperia : undefined;
}

/** Kasperia nomme le réseau de test « testnet-10 » (variantes tolérées). */
const isTestnet10 = (network: unknown) =>
  typeof network === "string" && /testnet[-_]?10/i.test(network);

/** Wallets présents sur cet appareil (wallet intégré, extensions). */
export function detectWallets(): Record<WalletChoice, boolean> {
  return {
    builtin: hasBuiltinWallet(),
    kastle: !!getKastle(),
    kasperia: !!getKasperia(),
  };
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
let kasperiaBound = false;
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

  // Les événements Kastle ne concernent que les sessions Kastle.
  const usingKastle = () => load().isConnected && load().kind === undefined;
  kastle.on("kas:account_changed", (address) => {
    kastleEvents += 1;
    if (!usingKastle()) return;
    setState(address ? { isConnected: true, address } : DISCONNECTED);
  });
  kastle.on("kas:network_changed", (network) => {
    kastleEvents += 1;
    if (network !== KASTLE_NETWORK && usingKastle()) setState(DISCONNECTED);
  });

  if (usingKastle()) {
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

/** Comme bindKastle, pour Kasperia. */
function bindKasperia() {
  if (kasperiaBound || getWalletMode() !== "kastle") return;
  const kasperia = getKasperia();
  if (!kasperia) return;
  kasperiaBound = true;

  const usingKasperia = () => load().isConnected && load().kind === "kasperia";
  kasperia.on("accountsChanged", (accounts) => {
    if (!usingKasperia()) return;
    const address = accounts?.[0];
    setState(address ? { isConnected: true, address, kind: "kasperia" } : DISCONNECTED);
  });
  kasperia.on("networkChanged", (network) => {
    if (!isTestnet10(network) && usingKasperia()) setState(DISCONNECTED);
  });

  if (usingKasperia()) {
    void Promise.all([kasperia.getNetwork(), kasperia.getAccounts()])
      .then(([network, accounts]) => {
        const address = accounts?.[0];
        setState(
          isTestnet10(network) && address
            ? { isConnected: true, address, kind: "kasperia" }
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

async function connectKasperia(): Promise<string> {
  const kasperia = getKasperia();
  if (!kasperia) throw new WalletError(msg("wallet.err.noExtension"));
  bindKasperia();

  try {
    let accounts: string[];
    try {
      accounts = await kasperia.requestAccounts();
    } catch {
      throw new WalletError(msg("wallet.err.refused"));
    }
    try {
      if (!isTestnet10(await kasperia.getNetwork())) {
        await kasperia.switchNetwork(KASTLE_NETWORK);
        accounts = await kasperia.getAccounts();
      }
    } catch {
      throw new WalletError(msg("wallet.err.network"));
    }
    if (!isTestnet10(await kasperia.getNetwork())) throw new WalletError(msg("wallet.err.network"));
    const address = accounts?.[0];
    if (!address) throw new WalletError(msg("wallet.err.noAccount"));
    if (!address.startsWith("kaspatest:")) throw new WalletError(msg("wallet.err.network"));

    setState({ isConnected: true, address, kind: "kasperia" });
    return address;
  } catch (e) {
    setState(DISCONNECTED);
    throw e;
  }
}

/**
 * Connecte le wallet et renvoie son adresse. `choice` vient de la fenêtre
 * « Connecter un wallet » ; sans choix : wallet intégré, sinon Kastle.
 */
export async function connectWallet(choice?: WalletChoice): Promise<string> {
  if (getWalletMode() === "kastle") {
    if (choice === "builtin") return connectBuiltin();
    if (choice === "kastle") return connectKastle();
    if (choice === "kasperia") return connectKasperia();
    // Wallet intégré s'il existe (marche partout), sinon l'extension Kastle,
    // sinon il faut en créer un.
    if (hasBuiltinWallet()) return connectBuiltin();
    if (getKastle()) return connectKastle();
    throw new NeedWalletError(msg("wallet.err.needWallet"));
  }
  await delay(500);
  const address = `kaspa:mock${randomHex(20)}`;
  setState({ isConnected: true, address });
  return address;
}

/**
 * Déconnecte le wallet. Wallet intégré : la clé est aussi oubliée (verrouillé),
 * le code sera redemandé pour se reconnecter ou s'engager.
 */
export function disconnectWallet(): void {
  if (load().kind === "builtin") lockBuiltin();
  if (getWalletMode() === "kastle" && load().kind === undefined)
    void getKastle()
      ?.disconnect()
      .catch(() => undefined);
  if (getWalletMode() === "kastle" && load().kind === "kasperia")
    void getKasperia()
      ?.request?.({ method: "kasperia_disconnect", params: {} })
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
  bindKasperia();
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
 * Publie un message du registre (docs/registre-kaspa.md) : le wallet envoie
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
  if (load().kind === "builtin") {
    try {
      return await builtinSend(registryAddress, sompi, payloadHex);
    } catch (e) {
      throw new WalletError(builtinErrorMessage(e));
    }
  }
  if (load().kind === "kasperia") {
    const kasperia = getKasperia();
    if (!kasperia) throw new WalletError(msg("wallet.err.noExtension"));
    if (!isTestnet10(await kasperia.getNetwork())) throw new WalletError(msg("wallet.err.network"));
    let txid: string | undefined;
    try {
      const sent = await kasperia.sendKaspa(registryAddress, String(sompi), {
        payload: payloadHex,
      });
      txid =
        typeof sent === "string"
          ? sent
          : ((sent as { txid?: string; transactionId?: string } | null)?.txid ??
            (sent as { transactionId?: string } | null)?.transactionId);
    } catch (e) {
      throw new WalletError(sendErrorMessage(e));
    }
    if (!txid) throw new WalletError(msg("wallet.err.sendFailed"));
    return txid;
  }
  const kastle = requireKastle();
  if ((await kastle.getNetwork()) !== KASTLE_NETWORK) {
    throw new WalletError(msg("wallet.err.network"));
  }
  try {
    return await kastle.sendKaspa(registryAddress, sompi, { payload: payloadHex });
  } catch (e) {
    throw new WalletError(sendErrorMessage(e));
  }
}

/**
 * Raison lisible d'un échec d'envoi Kastle (messages lus dans son code :
 * api/background/handlers/kaspa/sendSompi.ts). Inconnue : le texte de Kastle,
 * raccourci, pour pouvoir comprendre ce qui s'est passé.
 */
export function sendErrorMessage(e: unknown): string {
  // Kastle rejette avec une Error (texte) ou un objet d'erreur { code, message }.
  const raw =
    e instanceof Error
      ? e.message
      : typeof e === "string"
        ? e
        : typeof e === "object" &&
            e !== null &&
            typeof (e as { message?: unknown }).message === "string"
          ? (e as { message: string }).message
          : "";
  if (/no utxos/i.test(raw)) return msg("wallet.err.noFunds");
  if (/host not connected|not initialized/i.test(raw)) return msg("wallet.err.reconnect");
  if (/batch/i.test(raw)) return msg("wallet.err.compound");
  if (/insufficient|not enough|balance/i.test(raw)) return msg("wallet.err.noFunds");
  if (/reject|denied|cancel|refus|closed|user/i.test(raw) || raw === "") {
    return msg("wallet.err.sendRefused");
  }
  return `${msg("wallet.err.sendFailed")} ${raw.slice(0, 160)}`;
}

/** Raison lisible d'un échec du wallet intégré. */
export function builtinErrorMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : "";
  if (/insufficient_funds/.test(raw)) return msg("wallet.err.noFunds");
  if (/no_node|node_unreachable|node_timeout/.test(raw)) return msg("wallet.err.node");
  if (/no_wallet/.test(raw)) return msg("wallet.err.needWallet");
  return `${msg("wallet.err.sendFailed")} ${raw.slice(0, 160)}`;
}

/** Signe un message (Kastle : signature réelle ; mock : aléatoire, non vérifiable). */
export async function signMessage(message: string): Promise<string> {
  if (!load().isConnected) throw new WalletError(msg("wallet.err.notConnected"));
  if (load().kind) throw new WalletError(msg("wallet.err.needKastle"));
  if (getWalletMode() === "kastle") return requireKastle().signMessage(message);
  await delay(300);
  return `mocksig_${randomHex(32)}`;
}
