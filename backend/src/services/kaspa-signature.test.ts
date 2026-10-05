// Vecteurs de test officiels de rusty-kaspa :
//   crypto/addresses/src/lib.rs  (adresses)
//   wallet/core/src/message.rs   (signatures de message, test_case_0..2)
import { schnorr } from "@noble/curves/secp256k1.js";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";
import { describe, expect, it } from "vitest";

import {
  decodeKaspaAddress,
  encodeKaspaAddress,
  personalMessageHash,
  verifyKaspaMessage,
} from "./kaspa-signature.js";

const zeros = (n: number) => new Uint8Array(n);

describe("adresses Kaspa (vecteurs rusty-kaspa)", () => {
  const vectors: [string, number, Uint8Array, string][] = [
    ["a", 0, new Uint8Array(), "a:qqeq69uvrh"],
    ["a", 8, new Uint8Array(), "a:pq99546ray"],
    ["b", 8, utf8ToBytes("abc"), "b:ppskycc8txxxn2w"],
    [
      "b",
      8,
      utf8ToBytes("abcdefghijklmnopqrstuvwxyz"),
      "b:ppskycmyv4nxw6rfdf4kcmtwdac8zunnw36hvamc09aqtpppz8lk",
    ],
    [
      "kaspatest",
      0,
      zeros(32),
      "kaspatest:qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqhqrxplya",
    ],
    [
      "kaspatest",
      1,
      zeros(33),
      "kaspatest:qyqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqhe837j2d",
    ],
    [
      "kaspatest",
      1,
      hexToBytes("ba01fc5f4e9d9879599c69a3dafdb835a7255e5f2e934e9322ecd3af190ab0f60e"),
      "kaspatest:qxaqrlzlf6wes72en3568khahq66wf27tuhfxn5nytkd8tcep2c0vrse6gdmpks",
    ],
    ["kaspa", 0, zeros(32), "kaspa:qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqkx9awp4e"],
    [
      "kaspa",
      0,
      hexToBytes("5fff3c4da18f45adcdd499e44611e9fff148ba69db3c4ea2ddd955fc46a59522"),
      "kaspa:qp0l70zd5x85ttwd6jv7g3s3a8llzj96d8dncn4zmhv4tlzx5k2jyqh70xmfj",
    ],
  ];

  it.each(vectors)("encode %s v%i → %#", (prefix, version, payload, expected) => {
    expect(encodeKaspaAddress(prefix, version, payload)).toBe(expected);
  });

  it.each(vectors)("décode %s v%i ← %#", (prefix, version, payload, address) => {
    const d = decodeKaspaAddress(address);
    expect(d.prefix).toBe(prefix);
    expect(d.version).toBe(version);
    expect(bytesToHex(d.payload)).toBe(bytesToHex(payload));
  });

  it("rejette une somme de contrôle fausse, des majuscules ou des caractères invalides", () => {
    const good = "kaspa:qp0l70zd5x85ttwd6jv7g3s3a8llzj96d8dncn4zmhv4tlzx5k2jyqh70xmfj";
    expect(() => decodeKaspaAddress(good.slice(0, -1) + "k")).toThrow();
    expect(() => decodeKaspaAddress(good.toUpperCase())).toThrow();
    expect(() => decodeKaspaAddress("kaspa:qp0lb")).toThrow();
    expect(() => decodeKaspaAddress("sansprefixe")).toThrow();
  });
});

describe("signature de message Kaspa (vecteurs rusty-kaspa)", () => {
  const cases = [
    {
      name: "test_case_0",
      message: "Hello Kaspa!",
      privkey: "0000000000000000000000000000000000000000000000000000000000000003",
      auxRand: "0000000000000000000000000000000000000000000000000000000000000000",
      pubkey: "f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9",
      signature:
        "40b9bb2be0ae02607279eda64015a8d86e37632791703" +
        "40b8243f7ce5344d77aff1191598baf2fd26149cac3b4b12c2c433261c00834db6098cb172aa48ef522",
    },
    {
      name: "test_case_1",
      message: "Hello Kaspa!",
      privkey: "b7e151628aed2a6abf7158809cf4f3c762e7160f38b4da56a784d9045190cfef",
      auxRand: "0000000000000000000000000000000000000000000000000000000000000001",
      pubkey: "dff1d77f2a671c5f36183726db2341be58feae1da2deced843240f7b502ba659",
      signature:
        "eb9e8a3c547eb91b6a7592644f328f0648bdd21aba3cd44787d429d4d790aa8b" +
        "962745691f3b472ed8d65f3b770ecb4f777bd17b1d309100919b53e0e206b4c6",
    },
    {
      name: "test_case_2",
      message: "こんにちは世界",
      privkey: "b7e151628aed2a6abf7158809cf4f3c762e7160f38b4da56a784d9045190cfef",
      auxRand: "0000000000000000000000000000000000000000000000000000000000000001",
      pubkey: "dff1d77f2a671c5f36183726db2341be58feae1da2deced843240f7b502ba659",
      signature:
        "810653d5f80206db519672362add6c98dad378844e5ba4d89a22c9f0c7092e8c" +
        "ecba734fff7922b656b4be3f4b1f098899c95cb5c1023dce3519208afafb59bc",
    },
  ];

  it.each(cases)("$name : même signature que rusty-kaspa", (c) => {
    const sig = schnorr.sign(
      personalMessageHash(c.message),
      hexToBytes(c.privkey),
      hexToBytes(c.auxRand),
    );
    expect(bytesToHex(sig)).toBe(c.signature);
    expect(bytesToHex(schnorr.getPublicKey(hexToBytes(c.privkey)))).toBe(c.pubkey);
  });

  it.each(cases)("$name : vérifiée via l'adresse testnet de la clé", (c) => {
    const address = encodeKaspaAddress("kaspatest", 0, hexToBytes(c.pubkey));
    const base = { message: c.message, address, expectedPrefix: "kaspatest" };
    expect(verifyKaspaMessage({ ...base, signatureHex: c.signature })).toBe(true);
    expect(verifyKaspaMessage({ ...base, signatureHex: c.signature.toUpperCase() })).toBe(true);
  });

  it("refuse message modifié, mauvaise clé, mauvais réseau et signature mal formée", () => {
    const c = cases[0]!;
    const address = encodeKaspaAddress("kaspatest", 0, hexToBytes(c.pubkey));
    const ok = {
      message: c.message,
      signatureHex: c.signature,
      address,
      expectedPrefix: "kaspatest",
    };
    expect(verifyKaspaMessage({ ...ok, message: "Not Hello Kaspa!" })).toBe(false);
    expect(
      verifyKaspaMessage({
        ...ok,
        address: encodeKaspaAddress("kaspatest", 0, hexToBytes(cases[1]!.pubkey)),
      }),
    ).toBe(false);
    expect(verifyKaspaMessage({ ...ok, expectedPrefix: "kaspa" })).toBe(false);
    expect(
      verifyKaspaMessage({ ...ok, address: encodeKaspaAddress("kaspa", 0, hexToBytes(c.pubkey)) }),
    ).toBe(false);
    expect(verifyKaspaMessage({ ...ok, signatureHex: "00".repeat(64) })).toBe(false);
    expect(verifyKaspaMessage({ ...ok, signatureHex: "zz" })).toBe(false);
    expect(verifyKaspaMessage({ ...ok, address: "kaspatest:invalide" })).toBe(false);
    // Adresse ECDSA (v1) : non acceptée pour ce flux.
    expect(
      verifyKaspaMessage({ ...ok, address: encodeKaspaAddress("kaspatest", 1, zeros(33)) }),
    ).toBe(false);
  });
});
