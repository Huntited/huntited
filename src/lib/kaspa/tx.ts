// Transactions Kaspa signées dans le navigateur (wallet intégré, docs/wallet.md).
// Hachage de signature, masse et frais selon rusty-kaspa (consensus/core :
// hashing/sighash.rs, mass/mod.rs). Une entrée = une sortie Schnorr (version 0).
import { schnorr } from "@noble/curves/secp256k1.js";
import { blake2b } from "@noble/hashes/blake2.js";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";

export interface Utxo {
  transactionId: string;
  index: number;
  amount: bigint;
  /** Script de la sortie dépensée (hex, sans la version). */
  script: string;
}

export interface TxOutput {
  amount: bigint;
  script: Uint8Array;
}

export interface Transaction {
  version: number;
  inputs: { utxo: Utxo; signatureScript: Uint8Array; sequence: bigint; sigOpCount: number }[];
  outputs: TxOutput[];
  lockTime: bigint;
  subnetworkId: Uint8Array;
  gas: bigint;
  payload: Uint8Array;
}

const SIGHASH_ALL = 1;
const SIGNING_KEY = utf8ToBytes("TransactionSigningHash");
const ZERO_HASH = new Uint8Array(32);
/** Paramètre de masse de stockage (KIP-9) et limite de masse d'une transaction. */
const STORAGE_MASS_PARAMETER = 1_000_000_000_000n;
export const MAX_TX_MASS = 100_000n;
const SCHNORR_SIG_SCRIPT_LEN = 66;

class Writer {
  private parts: number[] = [];
  u8(v: number) {
    this.parts.push(v & 0xff);
    return this;
  }
  u16(v: number) {
    return this.u8(v).u8(v >> 8);
  }
  u32(v: number) {
    for (let i = 0; i < 4; i++) this.u8(v >>> (8 * i));
    return this;
  }
  u64(v: bigint) {
    for (let i = 0n; i < 8n; i++) this.u8(Number((v >> (8n * i)) & 0xffn));
    return this;
  }
  bytes(b: Uint8Array) {
    for (const x of b) this.parts.push(x);
    return this;
  }
  varBytes(b: Uint8Array) {
    return this.u64(BigInt(b.length)).bytes(b);
  }
  done() {
    return new Uint8Array(this.parts);
  }
}

const hash = (data: Uint8Array) => blake2b(data, { key: SIGNING_KEY, dkLen: 32 });

/** Hachage de signature (SigHashAll) de l'entrée `i`. */
export function sigHash(tx: Transaction, i: number): Uint8Array {
  const outpoints = new Writer();
  const sequences = new Writer();
  const sigOps = new Writer();
  for (const input of tx.inputs) {
    outpoints.bytes(hexToBytes(input.utxo.transactionId)).u32(input.utxo.index);
    sequences.u64(input.sequence);
    sigOps.u8(input.sigOpCount);
  }
  const outputs = new Writer();
  for (const o of tx.outputs) outputs.u64(o.amount).u16(0).varBytes(o.script);
  const native = tx.subnetworkId.every((b) => b === 0);
  const payloadHash =
    native && tx.payload.length === 0 ? ZERO_HASH : hash(new Writer().varBytes(tx.payload).done());
  const input = tx.inputs[i]!;
  const w = new Writer()
    .u16(tx.version)
    .bytes(hash(outpoints.done()))
    .bytes(hash(sequences.done()))
    .bytes(hash(sigOps.done()))
    .bytes(hexToBytes(input.utxo.transactionId))
    .u32(input.utxo.index)
    .u16(0)
    .varBytes(hexToBytes(input.utxo.script))
    .u64(input.utxo.amount)
    .u64(input.sequence)
    .u8(input.sigOpCount)
    .bytes(hash(outputs.done()))
    .u64(tx.lockTime)
    .bytes(tx.subnetworkId)
    .u64(tx.gas)
    .bytes(payloadHash)
    .u8(SIGHASH_ALL);
  return hash(w.done());
}

/** Signe toutes les entrées (clé Schnorr unique du wallet). */
export function signTransaction(tx: Transaction, privateKey: Uint8Array): Transaction {
  const inputs = tx.inputs.map((input, i) => {
    const sig = schnorr.sign(sigHash(tx, i), privateKey);
    return { ...input, signatureScript: new Uint8Array([0x41, ...sig, SIGHASH_ALL]) };
  });
  return { ...tx, inputs };
}

/** Taille sérialisée (signatures Schnorr comptées même avant de signer). */
function serializedSize(tx: Transaction): bigint {
  let size = 2 + 8 + 8 + 8 + 20 + 8 + 32 + 8 + tx.payload.length;
  for (const input of tx.inputs) {
    size += 32 + 4 + 8 + Math.max(input.signatureScript.length, SCHNORR_SIG_SCRIPT_LEN) + 8;
  }
  for (const o of tx.outputs) size += 8 + 2 + 8 + o.script.length;
  return BigInt(size);
}

/** Masse de stockage (KIP-9) : décourage les petites sorties. */
function storageMass(tx: Transaction): bigint {
  const C = STORAGE_MASS_PARAMETER;
  const outs = tx.outputs.reduce((s, o) => s + C / o.amount, 0n);
  const ins = tx.inputs.map((x) => x.utxo.amount);
  const relaxed =
    tx.outputs.length === 1 || ins.length === 1 || (tx.outputs.length === 2 && ins.length === 2);
  const insTerm = relaxed
    ? ins.reduce((s, v) => s + C / v, 0n)
    : BigInt(ins.length) * (C / (ins.reduce((s, v) => s + v, 0n) / BigInt(ins.length)));
  return outs > insTerm ? outs - insTerm : 0n;
}

function massParts(tx: Transaction) {
  const size = serializedSize(tx);
  const compute =
    size +
    tx.outputs.reduce((s, o) => s + BigInt(2 + o.script.length) * 10n, 0n) +
    BigInt(tx.inputs.reduce((s, x) => s + x.sigOpCount, 0)) * 1000n;
  return { compute, transient: size * 4n, storage: storageMass(tx) };
}

/** Masse de la transaction : la plus grande des masses de calcul, transitoire et de stockage. */
export function transactionMass(tx: Transaction): bigint {
  const { compute, transient, storage } = massParts(tx);
  return [compute, transient, storage].reduce((a, b) => (a > b ? a : b));
}

/**
 * Frais minimaux exigés par les nœuds : 100 sompi par gramme de masse de
 * calcul (relais minimal), et au moins la masse de stockage.
 */
export const MIN_RELAY_FEE_PER_GRAM = 100n;

/**
 * Construit une transaction : les UTXO (les plus gros d'abord) couvrent les
 * sorties et les frais ; la monnaie revient à `changeScript`. Frais = masse
 * × `feeRate` (sompi par gramme), avec une petite marge.
 */
export function buildTransaction(
  utxos: Utxo[],
  outputs: TxOutput[],
  changeScript: Uint8Array,
  payload: Uint8Array,
  feeRate = 1n,
): { tx: Transaction; fee: bigint } {
  const sorted = [...utxos].sort((a, b) =>
    b.amount > a.amount ? 1 : b.amount < a.amount ? -1 : 0,
  );
  const want = outputs.reduce((s, o) => s + o.amount, 0n);
  const picked: Utxo[] = [];
  let total = 0n;
  for (const u of sorted) {
    picked.push(u);
    total += u.amount;
    if (total <= want) continue;
    // Avec la monnaie ; sinon (monnaie trop petite pour la masse de stockage),
    // sans elle : le reste part en frais.
    for (const withChange of [true, false]) {
      let fee = feeFor(
        makeTx(picked, outputs, changeScript, payload, withChange ? total - want : 0n),
        feeRate,
      );
      for (let round = 0; round < 3; round++) {
        if (total < want + fee) break;
        const change = withChange ? total - want - fee : 0n;
        if (withChange && change <= 0n) break;
        const tx = makeTx(picked, outputs, changeScript, payload, change);
        const needed = feeFor(tx, feeRate);
        if (needed <= fee || !withChange) {
          if (transactionMass(tx) <= MAX_TX_MASS && total >= want + needed) {
            return { tx, fee: withChange ? fee : total - want };
          }
          break;
        }
        fee = needed;
      }
    }
    if (picked.length >= 80) break;
  }
  throw new Error("insufficient_funds");
}

function makeTx(
  utxos: Utxo[],
  outputs: TxOutput[],
  changeScript: Uint8Array,
  payload: Uint8Array,
  change: bigint,
): Transaction {
  const outs = change > 0n ? [...outputs, { amount: change, script: changeScript }] : outputs;
  const tx: Transaction = {
    version: 0,
    inputs: utxos.map((utxo) => ({
      utxo,
      signatureScript: new Uint8Array(),
      sequence: 0n,
      sigOpCount: 1,
    })),
    outputs: outs,
    lockTime: 0n,
    subnetworkId: new Uint8Array(20),
    gas: 0n,
    payload,
  };
  return tx;
}

function feeFor(tx: Transaction, feeRate: bigint): bigint {
  const { compute, storage } = massParts(tx);
  const relay = compute * MIN_RELAY_FEE_PER_GRAM;
  const wanted = compute * feeRate;
  const fee = [relay, wanted, storage].reduce((a, b) => (a > b ? a : b));
  return (fee * 11n) / 10n + 1n; // +10 % de marge
}

/** Forme attendue par le nœud (wRPC JSON, méthode submitTransaction). */
export function toRpc(tx: Transaction) {
  return {
    version: tx.version,
    inputs: tx.inputs.map((x) => ({
      previousOutpoint: { transactionId: x.utxo.transactionId, index: x.utxo.index },
      signatureScript: bytesToHex(x.signatureScript),
      sequence: Number(x.sequence),
      sigOpCount: x.sigOpCount,
    })),
    outputs: tx.outputs.map((o) => ({
      value: Number(o.amount),
      scriptPublicKey: `0000${bytesToHex(o.script)}`,
    })),
    lockTime: Number(tx.lockTime),
    subnetworkId: bytesToHex(tx.subnetworkId),
    gas: Number(tx.gas),
    payload: bytesToHex(tx.payload),
    mass: 0,
  };
}
