// Wallet intégré (docs/wallet.md) : un wallet Kaspa créé dans le navigateur,
// sans extension, qui marche aussi sur téléphone et dans l'app Huntited Chat.
//
// - Phrase de récupération de 12 mots (BIP39, anglais) ; clé dérivée sur le
//   chemin de Kaspa m/44'/111111'/0'/0/0, comme Kastle et Kaspium : la même
//   phrase y retrouve le même compte.
// - La phrase reste sur cet appareil (stockage du navigateur). Réseau de test
//   seulement tant que ce code n'a pas été audité.
// - Envoi : UTXO et transaction par un nœud Kaspa public (src/lib/kaspa).
import { schnorr } from "@noble/curves/secp256k1.js";
import { hexToBytes } from "@noble/hashes/utils.js";
import { HDKey } from "@scure/bip32";
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";

import { addressScript, decodeAddress, encodeAddress } from "./kaspa/address";
import { getUtxos, submitTransaction } from "./kaspa/node";
import { buildTransaction, signTransaction, toRpc } from "./kaspa/tx";

const STORAGE = "huntited:builtin-wallet";
const PATH = "m/44'/111111'/0'/0/0";

interface Stored {
  v: 1;
  phrase: string;
  createdAt: number;
}

/** Réseau Kaspa d'une adresse (« kaspatest: » → réseau de test 10). */
export const networkOf = (address: string) =>
  address.startsWith("kaspatest:") ? "testnet-10" : "mainnet";

function read(): Stored | null {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE) ?? "null") as Stored | null;
    return raw?.v === 1 && validateMnemonic(raw.phrase, wordlist) ? raw : null;
  } catch {
    return null;
  }
}

function write(phrase: string): void {
  localStorage.setItem(
    STORAGE,
    JSON.stringify({ v: 1, phrase, createdAt: Date.now() } satisfies Stored),
  );
  cache = null;
}

let cache: { phrase: string; key: Uint8Array } | null = null;

function privateKey(): Uint8Array | null {
  const s = read();
  if (!s) return null;
  if (cache?.phrase === s.phrase) return cache.key;
  const key = HDKey.fromMasterSeed(mnemonicToSeedSync(s.phrase)).derive(PATH).privateKey;
  if (!key) return null;
  cache = { phrase: s.phrase, key };
  return key;
}

export const hasBuiltinWallet = () => read() !== null;

/** Crée un wallet neuf et renvoie sa phrase de récupération (à faire noter). */
export function createBuiltinWallet(): string {
  const phrase = generateMnemonic(wordlist, 128);
  write(phrase);
  return phrase;
}

/** Retrouve un wallet par sa phrase ; false si la phrase n'est pas valable. */
export function importBuiltinWallet(phrase: string): boolean {
  const clean = phrase.trim().toLowerCase().split(/\s+/).join(" ");
  if (!validateMnemonic(clean, wordlist)) return false;
  write(clean);
  return true;
}

export function builtinPhrase(): string | null {
  return read()?.phrase ?? null;
}

/** Retire le wallet de cet appareil (la phrase permet de le retrouver). */
export function removeBuiltinWallet(): void {
  localStorage.removeItem(STORAGE);
  cache = null;
}

/** Adresse du wallet sur le réseau du registre Huntited (préfixe). */
export function builtinAddress(prefix: "kaspatest" | "kaspa"): string | null {
  const key = privateKey();
  return key ? encodeAddress(prefix, 0, schnorr.getPublicKey(key)) : null;
}

/** Solde (sompi). */
export async function builtinBalance(address: string): Promise<bigint> {
  const utxos = await getUtxos(networkOf(address), address);
  return utxos.reduce((s, u) => s + u.amount, 0n);
}

/** Envoie `sompi` à `to`, avec le message `payloadHex`. Renvoie l'identifiant de transaction. */
export async function builtinSend(to: string, sompi: number, payloadHex: string): Promise<string> {
  const key = privateKey();
  if (!key) throw new Error("no_wallet");
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
  return submitTransaction(network, toRpc(signTransaction(tx, key)));
}
