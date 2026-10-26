// Wallet intégré (docs/wallet.md) : un wallet Kaspa créé dans le navigateur,
// sans extension, qui marche aussi sur téléphone et dans l'app Huntited Chat.
//
// - Phrase de récupération de 12 mots (BIP39, anglais) ; clé dérivée sur le
//   chemin de Kaspa m/44'/111111'/0'/0/0, comme Kastle et Kaspium : la même
//   phrase y retrouve le même compte.
// - La phrase reste sur cet appareil (stockage du navigateur). Elle peut être
//   protégée par un code, par l'empreinte ou le visage (app Huntited Chat :
//   clé gardée par la puce sécurisée du téléphone), ou par les deux.
// - Envoi : UTXO et transaction par un nœud Kaspa public (src/lib/kaspa).
// Réseau de test seulement tant que ce code n'a pas été audité.
import { schnorr } from "@noble/curves/secp256k1.js";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";
import { HDKey } from "@scure/bip32";
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";

import { bioAvailable, bioDecrypt, bioEncrypt } from "./bio";
import { addressScript, decodeAddress, encodeAddress } from "./kaspa/address";
import { getUtxos, submitTransaction } from "./kaspa/node";
import { buildTransaction, signTransaction, toRpc } from "./kaspa/tx";

const STORAGE = "huntited:builtin-wallet";
const PATH = "m/44'/111111'/0'/0/0";
/** Dérivation du code (PBKDF2-SHA256, recommandation OWASP). */
const CODE_ITERATIONS = 600_000;
/** Après 5 codes faux : attente de 30 s, doublée à chaque erreur (1 h au plus). */
const FREE_TRIES = 5;

export type CodeKind = "pin" | "password";

export interface Protection {
  /** Code demandé (chiffres ou mot de passe), ou rien. */
  code: CodeKind | null;
  /** Empreinte ou visage (app Huntited Chat). */
  bio: boolean;
  /** Reverrouillage : 0 = à chaque opération ; -1 = à la fermeture de la page ; sinon ms. */
  lockAfterMs: number;
  /** Effacer le wallet après ce nombre de codes faux (0 = jamais). */
  wipeAfter: number;
}

interface Stored {
  v: 2;
  /** Clé publique (x seule) : adresses et solde sans déverrouiller. */
  pub: string;
  /** Phrase en clair (sans protection) ou chiffrée (base64, couches code puis empreinte). */
  phrase?: string;
  sealed?: string;
  code?: { kind: CodeKind; salt: string; iter: number };
  bio?: boolean;
  lockAfterMs: number;
  wipeAfter: number;
  fails: number;
  waitUntil: number;
  createdAt: number;
}

/** Réseau Kaspa d'une adresse (« kaspatest: » → réseau de test 10). */
export const networkOf = (address: string) =>
  address.startsWith("kaspatest:") ? "testnet-10" : "mainnet";

const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

function read(): Stored | null {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE) ?? "null") as
      Stored | { v: 1; phrase: string; createdAt: number } | null;
    if (!raw) return null;
    // Ancien format (sans protection) : migré tel quel.
    if (raw.v === 1) {
      if (!validateMnemonic(raw.phrase, wordlist)) return null;
      return plain(raw.phrase, raw.createdAt);
    }
    return raw.v === 2 && /^[0-9a-f]{64}$/.test(raw.pub) ? raw : null;
  } catch {
    return null;
  }
}

function save(s: Stored): void {
  localStorage.setItem(STORAGE, JSON.stringify(s));
}

const keyOf = (phrase: string) => {
  const key = HDKey.fromMasterSeed(mnemonicToSeedSync(phrase)).derive(PATH).privateKey;
  if (!key) throw new Error("bad_key");
  return key;
};

function plain(phrase: string, createdAt = Date.now()): Stored {
  return {
    v: 2,
    pub: bytesToHex(schnorr.getPublicKey(keyOf(phrase))),
    phrase,
    lockAfterMs: 0,
    wipeAfter: 0,
    fails: 0,
    waitUntil: 0,
    createdAt,
  };
}

// --- Session déverrouillée (en mémoire seulement) ---

let session: { phrase: string; key: Uint8Array; until: number } | null = null;

function open(phrase: string, lockAfterMs: number) {
  const until =
    lockAfterMs < 0 ? Number.POSITIVE_INFINITY : lockAfterMs === 0 ? 0 : Date.now() + lockAfterMs;
  session = { phrase, key: keyOf(phrase), until };
}

/** Phrase et clé utilisables maintenant, ou null (verrouillé). */
function unlocked(): { phrase: string; key: Uint8Array } | null {
  const s = read();
  if (!s) return null;
  if (s.phrase) return { phrase: s.phrase, key: keyOf(s.phrase) };
  // « À chaque opération » : la session ne sert qu'à l'opération en cours.
  if (session && (session.until === 0 || session.until > Date.now())) return session;
  session = null;
  return null;
}

/** Fin d'une opération : en mode « à chaque opération », on reverrouille. */
function afterUse() {
  if (session?.until === 0) session = null;
}

// --- Déverrouillage demandé à l'écran (src/components/WalletUnlock.tsx) ---

type UnlockHandler = () => Promise<boolean>;
let unlockHandler: UnlockHandler | null = null;
export function setUnlockHandler(h: UnlockHandler | null): void {
  unlockHandler = h;
}

async function requireUnlocked(): Promise<{ phrase: string; key: Uint8Array }> {
  const u = unlocked();
  if (u) return u;
  if (!unlockHandler || !(await unlockHandler())) throw new Error("locked");
  const again = unlocked();
  if (!again) throw new Error("locked");
  return again;
}

// --- Chiffrement : code (PBKDF2 + AES-GCM), puis empreinte (app) ---

async function codeKey(code: string, salt: Uint8Array, iter: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", utf8ToBytes(code), "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations: iter },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function seal(
  phrase: string,
  code: string | null,
  bio: boolean,
  kind: CodeKind,
): Promise<Pick<Stored, "sealed" | "code" | "bio">> {
  let data = utf8ToBytes(phrase);
  let codeMeta: Stored["code"];
  if (code) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await codeKey(code, salt, CODE_ITERATIONS);
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data));
    data = new Uint8Array([...iv, ...ct]);
    codeMeta = { kind, salt: bytesToHex(salt), iter: CODE_ITERATIONS };
  }
  if (bio) data = unb64(await bioEncrypt(b64(data)));
  return { sealed: b64(data), ...(codeMeta ? { code: codeMeta } : {}), bio };
}

export type UnlockResult = "ok" | "bad" | "wait" | "wiped" | "cancelled";

/** Déverrouille avec le code (s'il y en a un) et l'empreinte (si demandée). */
export async function unlockBuiltin(code?: string): Promise<UnlockResult> {
  const s = read();
  if (!s) return "wiped";
  if (s.phrase) {
    open(s.phrase, s.lockAfterMs);
    return "ok";
  }
  if (s.waitUntil > Date.now()) return "wait";
  let data = unb64(s.sealed ?? "");
  if (s.bio) {
    try {
      data = unb64(await bioDecrypt(b64(data)));
    } catch {
      return "cancelled";
    }
  }
  if (s.code) {
    try {
      const key = await codeKey(code ?? "", hexToBytes(s.code.salt), s.code.iter);
      data = new Uint8Array(
        await crypto.subtle.decrypt(
          { name: "AES-GCM", iv: data.slice(0, 12) },
          key,
          data.slice(12),
        ),
      );
    } catch {
      const fails = s.fails + 1;
      if (s.wipeAfter > 0 && fails >= s.wipeAfter) {
        removeBuiltinWallet();
        return "wiped";
      }
      const extra = fails - FREE_TRIES;
      const waitUntil = extra >= 0 ? Date.now() + Math.min(30_000 * 2 ** extra, 3_600_000) : 0;
      save({ ...s, fails, waitUntil });
      return "bad";
    }
  }
  const phrase = new TextDecoder().decode(data);
  if (!validateMnemonic(phrase, wordlist)) return "bad";
  if (s.fails) save({ ...s, fails: 0, waitUntil: 0 });
  open(phrase, s.lockAfterMs);
  return "ok";
}

export function lockBuiltin(): void {
  session = null;
}

/** Verrouillé : il faut déverrouiller avant d'envoyer ou d'afficher la phrase. */
export const isLocked = () => hasBuiltinWallet() && unlocked() === null;

/** Secondes d'attente avant le prochain essai de code (0 si aucune). */
export function unlockWaitSeconds(): number {
  const s = read();
  return s ? Math.max(0, Math.ceil((s.waitUntil - Date.now()) / 1000)) : 0;
}

export function builtinProtection(): Protection | null {
  const s = read();
  if (!s) return null;
  return {
    code: s.code?.kind ?? null,
    bio: s.bio === true,
    lockAfterMs: s.lockAfterMs,
    wipeAfter: s.wipeAfter,
  };
}

/** L'empreinte ou le visage peuvent protéger le wallet (app Huntited Chat). */
export const bioProtectionAvailable = bioAvailable;

/**
 * Change la protection (le wallet doit être déverrouillé). `code` : nouveau
 * code, ou null pour ne pas en demander.
 */
export async function protectBuiltin(
  opts: Omit<Protection, "code"> & { code: string | null; codeKind: CodeKind },
): Promise<void> {
  const u = await requireUnlocked();
  const s = read()!;
  const base = {
    v: 2 as const,
    pub: s.pub,
    lockAfterMs: opts.lockAfterMs,
    wipeAfter: opts.code ? opts.wipeAfter : 0,
    fails: 0,
    waitUntil: 0,
    createdAt: s.createdAt,
  };
  if (!opts.code && !opts.bio) {
    save({ ...base, phrase: u.phrase });
  } else {
    save({ ...base, ...(await seal(u.phrase, opts.code, opts.bio, opts.codeKind)) });
  }
  open(u.phrase, opts.lockAfterMs < 0 ? -1 : Math.max(opts.lockAfterMs, 60_000));
}

// --- Création, import, retrait ---

export const hasBuiltinWallet = () => read() !== null;

/** Crée un wallet neuf et renvoie sa phrase de récupération (à faire noter). */
export function createBuiltinWallet(): string {
  const phrase = generateMnemonic(wordlist, 128);
  save(plain(phrase));
  session = null;
  return phrase;
}

/** Retrouve un wallet par sa phrase ; false si la phrase n'est pas valable. */
export function importBuiltinWallet(phrase: string): boolean {
  const clean = phrase.trim().toLowerCase().split(/\s+/).join(" ");
  if (!validateMnemonic(clean, wordlist)) return false;
  save(plain(clean));
  session = null;
  return true;
}

/** Phrase de récupération (demande le déverrouillage si besoin). */
export async function builtinPhrase(): Promise<string | null> {
  if (!hasBuiltinWallet()) return null;
  const u = await requireUnlocked();
  afterUse();
  return u.phrase;
}

/** Retire le wallet de cet appareil (la phrase permet de le retrouver). */
export function removeBuiltinWallet(): void {
  localStorage.removeItem(STORAGE);
  session = null;
}

/** Adresse du wallet (lisible même verrouillé). */
export function builtinAddress(prefix: "kaspatest" | "kaspa"): string | null {
  const s = read();
  return s ? encodeAddress(prefix, 0, hexToBytes(s.pub)) : null;
}

/** Solde (sompi). */
export async function builtinBalance(address: string): Promise<bigint> {
  const utxos = await getUtxos(networkOf(address), address);
  return utxos.reduce((s, u) => s + u.amount, 0n);
}

/** Envoie `sompi` à `to`, avec le message `payloadHex`. Renvoie l'identifiant de transaction. */
export async function builtinSend(to: string, sompi: number, payloadHex: string): Promise<string> {
  if (!hasBuiltinWallet()) throw new Error("no_wallet");
  const { key } = await requireUnlocked();
  try {
    const prefix = decodeAddress(to).prefix as "kaspatest" | "kaspa";
    const from = builtinAddress(prefix)!;
    const network = networkOf(to);
    const utxos = await getUtxos(network, from);
    const change = addressScript(from);
    const { tx } = buildTransaction(
      utxos,
      [{ amount: BigInt(sompi), script: addressScript(to) }],
      change,
      hexToBytes(payloadHex),
    );
    return await submitTransaction(network, toRpc(signTransaction(tx, key)));
  } finally {
    afterUse();
  }
}
