// Calcul d'une preuve Semaphore dans le navigateur, sur un seul fil.
//
// Identique à generateProof de @semaphore-protocol/proof (mêmes entrées du
// circuit, même format de sortie), mais sans les « workers » parallèles de
// snarkjs : chacun réserve sa propre mémoire WebAssembly, ce qui fait échouer
// le calcul sur les téléphones modestes. Chargé à la demande (navigateur).
import type { Group, Identity } from "@semaphore-protocol/core";
import { packGroth16Proof } from "@zk-kit/utils/proof-packing";
import { encodeBytes32String, keccak256, toBeHex, toBigInt as ethersToBigInt } from "ethers";
import { groth16 } from "snarkjs";

/** Texte court ou nombre → élément de champ (comme la bibliothèque Semaphore). */
function toBigInt(value: string | number | bigint): bigint {
  try {
    return ethersToBigInt(value);
  } catch {
    if (typeof value === "string") return ethersToBigInt(encodeBytes32String(value));
    throw new TypeError("Valeur invalide.");
  }
}

/** Pages WebAssembly de 64 Ko : 1024 = 64 Mo. */
const WITNESS_MEMORY_PAGES = 1024;

/** Empreinte keccak256 compatible avec le module du circuit. */
const hash = (value: bigint) => BigInt(keccak256(toBeHex(value, 32))) >> 8n;

export async function generateProofSingleThread(
  identity: Identity,
  group: Group,
  message: string | number,
  scope: string,
  depth: number,
  artifacts: { wasm: string; zkey: string },
) {
  const index = group.indexOf(identity.commitment);
  if (index < 0) throw new Error("Ce pass ne fait pas partie du groupe.");
  const merkleProof = group.generateMerkleProof(index);
  const siblings = [...merkleProof.siblings];
  // Les emplacements inutilisés valent 0 (ignorés par le circuit).
  while (siblings.length < depth) siblings.push(0n);
  const m = toBigInt(message);
  const s = toBigInt(scope);

  const { proof, publicSignals } = await groth16.fullProve(
    {
      secret: identity.secretScalar,
      merkleProofLength: merkleProof.siblings.length,
      merkleProofIndex: merkleProof.index,
      merkleProofSiblings: siblings,
      scope: hash(s),
      message: hash(m),
    },
    artifacts.wasm,
    artifacts.zkey,
    undefined,
    // Mémoire du calcul du témoin : 2 Go réservés d'un coup par défaut (échecs
    // en série sur téléphone) ; ce circuit tient largement dans 64 Mo.
    { memorySize: WITNESS_MEMORY_PAGES },
    { singleThread: true },
  );
  return {
    merkleTreeDepth: depth,
    merkleTreeRoot: merkleProof.root.toString(),
    nullifier: String(publicSignals[1]),
    message: m.toString(),
    scope: s.toString(),
    points: packGroth16Proof(proof),
  };
}
