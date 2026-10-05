/**
 * Couche "covenant-ready".
 *
 * L'UI utilise uniquement cette interface pour interagir avec Huntited.
 * Aujourd'hui, l'implémentation est mockée avec localStorage.
 * Demain, elle sera remplacée par des appels aux covenants Kaspa sans
 * modifier les composants React.
 */

import { mockHunts } from "./mock-hunts";
import {
  getMockCommitCount,
  mockCommit,
  onCommitmentsChange,
} from "./mock-zk";
import { SOMPI_PER_KAS } from "./hunt-economics";
import type { Hunt, HuntFormData } from "./types";

/** Paramètres économiques fixes du MVP. */
export const CREATE_DEPOSIT_KAS = 30;
export const COMMIT_DEPOSIT_KAS = 5;

/** 1 KAS = 10^8 sompis — défini une seule fois dans hunt-economics.ts. */
export { SOMPI_PER_KAS };

export function kasToSompi(kas: number): bigint {
  if (!Number.isSafeInteger(kas) || kas < 0) {
    throw new Error("Montant KAS invalide.");
  }

  return BigInt(kas) * SOMPI_PER_KAS;
}

export type CovenantStatus = "active" | "activated" | "expired";

/**
 * Représentation simplifiée d'une chasse on-chain.
 */
export interface HuntCovenant {
  covenantId: string;
  huntId: string;
  threshold: number;
  deadline: number;
  creationDepositSompi: bigint;
  commitDepositSompi: bigint;
  commitCount: number;
  status: CovenantStatus;
}

/**
 * Reçoit le résultat de création.
 * Plus tard : contiendra un vrai hash de transaction Kaspa.
 */
export interface HuntCovenantReceipt {
  huntId: string;
  txId: string;
  depositKas: number;
}

/**
 * Reçoit le résultat d'un engagement.
 * Plus tard : contiendra la transaction et le commitment ZK.
 */
export interface CommitReceipt {
  huntId: string;
  commitment: string;
  txId: string;
  depositKas: number;
}

/**
 * Interface stable que le front utilisera avec le mock puis Kaspa.
 */
export interface CovenantClient {
  createHuntCovenant(data: HuntFormData): Promise<HuntCovenantReceipt>;
  commitToHunt(huntId: string, walletAddress: string): Promise<CommitReceipt>;
  getCommitCount(hunt: Hunt): number;
  getHunt(id: string): Hunt | undefined;
}

const CREATED_KEY = "huntited:mock-created-hunts";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function randomHex(bytes: number): string {
  const values = new Uint8Array(bytes);

  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(values);
  } else {
    for (let index = 0; index < values.length; index += 1) {
      values[index] = Math.floor(Math.random() * 256);
    }
  }

  return Array.from(values)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function readCreatedHunts(): Hunt[] {
  if (!isBrowser()) {
    return [];
  }

  try {
    const value = window.localStorage.getItem(CREATED_KEY);

    if (!value) {
      return [];
    }

    const stored: unknown = JSON.parse(value);

    if (!Array.isArray(stored)) {
      return [];
    }

    return stored.flatMap((item): Hunt[] => {
      if (
        typeof item !== "object" ||
        item === null ||
        !("id" in item) ||
        !("title" in item) ||
        !("description" in item) ||
        !("location" in item) ||
        !("deadline" in item) ||
        !("threshold" in item)
      ) {
        return [];
      }

      const candidate = item as Partial<Hunt>;

      if (
        typeof candidate.id !== "string" ||
        typeof candidate.title !== "string" ||
        typeof candidate.description !== "string" ||
        typeof candidate.location !== "string" ||
        typeof candidate.deadline !== "string" ||
        typeof candidate.threshold !== "number"
      ) {
        return [];
      }

      return [
        {
          id: candidate.id,
          title: candidate.title,
          description: candidate.description,
          location: candidate.location,
          deadline: candidate.deadline,
          threshold: candidate.threshold,
          deposit:
            typeof candidate.deposit === "number"
              ? candidate.deposit
              : CREATE_DEPOSIT_KAS,
          commitDeposit:
            typeof candidate.commitDeposit === "number"
              ? candidate.commitDeposit
              : COMMIT_DEPOSIT_KAS,
          commitCount:
            typeof candidate.commitCount === "number"
              ? candidate.commitCount
              : 0,
          // Anciennes chasses sans statut : considérées comme "active".
          status: candidate.status === "settled" ? "settled" : "active",
        },
      ];
    });
  } catch {
    return [];
  }
}

function saveCreatedHunts(hunts: Hunt[]): void {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(CREATED_KEY, JSON.stringify(hunts));
}

// Calculs de fin de chasse : voir src/lib/hunt-economics.ts (sompis, bigint).

/**
 * Crée une chasse dans le mock local.
 */
export async function createHuntCovenant(
  data: HuntFormData,
): Promise<HuntCovenantReceipt> {
  await delay(500);

  const huntId = randomHex(12);

  const hunt: Hunt = {
    id: huntId,
    title: data.title.trim(),
    description: data.description.trim(),
    location: data.location.trim(),
    deadline: new Date(data.deadline).toISOString(),
    threshold: data.threshold,
    deposit: CREATE_DEPOSIT_KAS,
    commitDeposit: COMMIT_DEPOSIT_KAS,
    commitCount: 0,
    status: "active",
  };

  saveCreatedHunts([...readCreatedHunts(), hunt]);

  return {
    huntId,
    txId: randomHex(32),
    depositKas: CREATE_DEPOSIT_KAS,
  };
}

/**
 * Effectue un engagement mocké.
 *
 * La version réelle demandera la signature du wallet, enverra 5 KAS
 * et ajoutera le commitment dans le covenant Kaspa.
 */
export async function commitToHunt(
  huntId: string,
  walletAddress: string,
): Promise<CommitReceipt> {
  const hunt = getHunt(huntId);

  if (!hunt) {
    throw new Error("Chasse introuvable.");
  }

  const status = getCovenantStatus(getHuntCovenant(hunt));

  if (status === "expired") {
    throw new Error("Cette chasse a expiré.");
  }

  if (status === "activated") {
    throw new Error("Cette chasse a déjà atteint son seuil.");
  }

  await delay(400);

  // Lève une erreur si ce wallet est déjà engagé (un engagement par wallet et par chasse).
  const { commitment } = await mockCommit(huntId, walletAddress);

  return {
    huntId,
    commitment,
    txId: randomHex(32),
    depositKas: hunt.commitDeposit,
  };
}

/**
 * Retourne le nombre total d'engagements du mock.
 */
export function getCommitCount(hunt: Hunt): number {
  return getMockCommitCount(hunt.id, hunt.commitCount);
}

/**
 * Lit une chasse connue : démo, puis localStorage.
 */
export function getHunt(id: string): Hunt | undefined {
  return (
    mockHunts.find((hunt) => hunt.id === id) ??
    readCreatedHunts().find((hunt) => hunt.id === id)
  );
}

/**
 * Important : l'activation est prioritaire sur l'expiration.
 *
 * Une fois le seuil atteint dans les temps, la chasse est définitivement
 * réussie, même si l'UI est relue après la deadline.
 */
export function getCovenantStatus(
  covenant: Pick<HuntCovenant, "deadline" | "commitCount" | "threshold">,
  now = Date.now(),
): CovenantStatus {
  if (covenant.commitCount >= covenant.threshold) {
    return "activated";
  }

  if (now > covenant.deadline) {
    return "expired";
  }

  return "active";
}

/**
 * Construit la vue mockée d'un covenant à partir d'une chasse.
 */
export function getHuntCovenant(hunt: Hunt): HuntCovenant {
  const deadline = new Date(hunt.deadline).getTime();
  const commitCount = getCommitCount(hunt);

  return {
    covenantId: `mock-covenant-${hunt.id}`,
    huntId: hunt.id,
    threshold: hunt.threshold,
    deadline,
    creationDepositSompi: kasToSompi(hunt.deposit),
    commitDepositSompi: kasToSompi(hunt.commitDeposit),
    commitCount,
    status: getCovenantStatus({
      deadline,
      commitCount,
      threshold: hunt.threshold,
    }),
  };
}

/**
 * Permet aux hooks React d’écouter les engagements mockés.
 */
export { onCommitmentsChange };

/**
 * Client par défaut, remplaçable à terme par une implémentation Kaspa.
 */
export const covenantClient: CovenantClient = {
  createHuntCovenant,
  commitToHunt,
  getCommitCount,
  getHunt,
};

/**
 * Toutes les chasses visibles dans le mock.
 */
export function listHunts(): Hunt[] {
  return [...mockHunts, ...readCreatedHunts()];
}