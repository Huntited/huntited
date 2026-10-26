// Adresses Kaspa (format cashaddr de Kaspa) : « kaspatest:q… » ou « kaspa:q… ».
// Version 0 : clé publique Schnorr (32 octets) ; 1 : ECDSA (33) ; 8 : P2SH (32).
const CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
const GENERATORS = [0x98f2bc8e61n, 0x79b76d99e2n, 0xf33e5fb3c4n, 0xae2eabe2a8n, 0x1e4f43e470n];

function polymod(values: number[]): bigint {
  let c = 1n;
  for (const d of values) {
    const c0 = c >> 35n;
    c = ((c & 0x07ffffffffn) << 5n) ^ BigInt(d);
    for (let i = 0; i < 5; i++) if ((c0 >> BigInt(i)) & 1n) c ^= GENERATORS[i]!;
  }
  return c ^ 1n;
}

function convertBits(
  data: Uint8Array | number[],
  from: number,
  to: number,
  pad: boolean,
): number[] {
  let acc = 0;
  let bits = 0;
  const out: number[] = [];
  const max = (1 << to) - 1;
  for (const v of data) {
    acc = (acc << from) | v;
    bits += from;
    while (bits >= to) {
      bits -= to;
      out.push((acc >> bits) & max);
    }
  }
  if (pad && bits > 0) out.push((acc << (to - bits)) & max);
  else if (!pad && (bits >= from || ((acc << (to - bits)) & max) !== 0))
    throw new Error("bad_padding");
  return out;
}

const prefixBits = (prefix: string) => [...prefix].map((ch) => ch.charCodeAt(0) & 0x1f);

export function encodeAddress(prefix: string, version: number, payload: Uint8Array): string {
  const data = convertBits(new Uint8Array([version, ...payload]), 8, 5, true);
  const checksum = polymod([...prefixBits(prefix), 0, ...data, 0, 0, 0, 0, 0, 0, 0, 0]);
  const check: number[] = [];
  for (let i = 7; i >= 0; i--) check.push(Number((checksum >> BigInt(i * 5)) & 31n));
  return `${prefix}:${[...data, ...check].map((d) => CHARSET[d]).join("")}`;
}

export function decodeAddress(address: string): {
  prefix: string;
  version: number;
  payload: Uint8Array;
} {
  const [prefix, rest] = address.toLowerCase().split(":");
  if (!prefix || !rest || rest.length < 9) throw new Error("bad_address");
  const values = [...rest].map((ch) => {
    const i = CHARSET.indexOf(ch);
    if (i < 0) throw new Error("bad_address");
    return i;
  });
  if (polymod([...prefixBits(prefix), 0, ...values]) !== 0n) throw new Error("bad_checksum");
  const bytes = convertBits(values.slice(0, -8), 5, 8, false);
  return { prefix, version: bytes[0]!, payload: new Uint8Array(bytes.slice(1)) };
}

/** Script de sortie (scriptPublicKey) qui paie cette adresse. */
export function addressScript(address: string): Uint8Array {
  const { version, payload } = decodeAddress(address);
  if (version === 0 && payload.length === 32) return new Uint8Array([0x20, ...payload, 0xac]);
  if (version === 1 && payload.length === 33) return new Uint8Array([0x21, ...payload, 0xab]);
  if (version === 8 && payload.length === 32) return new Uint8Array([0xaa, 0x20, ...payload, 0x87]);
  throw new Error("unsupported_address");
}
