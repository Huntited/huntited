// Pass Huntited : une personne vérifiée = un pass (anti-bots, docs/anti-bots.md).
//
// Le pass est une identité Semaphore créée sur cet appareil. Son secret ne
// quitte jamais l'appareil ; le serveur ne reçoit que son empreinte publique
// (pour rejoindre le groupe) puis des preuves anonymes : « je suis dans le
// groupe, et voici mon code pour cette chasse ». Personne, pas même le
// serveur, ne peut relier deux engagements entre eux ni à un pass.
//
// La bibliothèque (calculs ZK) est chargée seulement quand on en a besoin.
import { createClientOnlyFn } from "@tanstack/react-start";

import { apiFetch, ApiError } from "./api-client";
import type { MessageKey } from "./i18n";
import { getDataMode } from "./hunt-repository";

const STORAGE_KEY = "huntited:pass";
const SLOTS_KEY = "huntited:pass-invite-slots";
const PROOF_DEPTH = 20;
const isBrowser = () => typeof window !== "undefined";

/** Erreur affichable, sous forme de clé de traduction (voir messages/). */
export class PassError extends Error {
  constructor(public readonly key: MessageKey) {
    super(key);
  }
}

export interface PassConfig {
  /** Le registre partagé gère les pass (sinon : mode local, pas de pass). */
  available: boolean;
  /** Un pass est exigé pour s'engager. */
  required: boolean;
  invitesPerMonth: number;
}

let configCache: Promise<PassConfig> | null = null;

/** Configuration des pass du serveur (mise en cache). */
export function getPassConfig(): Promise<PassConfig> {
  if (getDataMode() !== "api") {
    return Promise.resolve({ available: false, required: false, invitesPerMonth: 0 });
  }
  configCache ??= apiFetch<{ required: boolean; invitesPerMonth: number }>(
    "GET",
    "/api/passes/config",
  )
    .then((c) => ({ available: true, ...c }))
    .catch(() => {
      configCache = null;
      return { available: false, required: false, invitesPerMonth: 0 };
    });
  return configCache;
}

// --- Stockage local --------------------------------------------------------

function readSecret(): string | null {
  if (!isBrowser()) return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

/** Cet appareil a-t-il un pass ? */
export function hasPass(): boolean {
  return readSecret() !== null;
}

export function onPassChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Secret du pass, pour une sauvegarde manuelle (à garder pour soi). */
export function exportPass(): string | null {
  return readSecret();
}

/** Oublie le pass sur cet appareil (sans sauvegarde, il est perdu). */
export function forgetPass(): void {
  window.localStorage.removeItem(STORAGE_KEY);
  notify();
}

// Navigateur uniquement : le rendu serveur n'embarque pas la bibliothèque ZK.
const lib = createClientOnlyFn(() => import("@semaphore-protocol/core"));
const prover = createClientOnlyFn(() => import("./zk-prove"));

async function identity() {
  const secret = readSecret();
  if (!secret) throw new PassError("pass.err.noPass");
  const { Identity } = await lib();
  return Identity.import(secret);
}

/** Restaure un pass sauvegardé (il doit déjà faire partie du groupe). */
export async function importPass(secret: string): Promise<void> {
  const { Identity } = await lib();
  let commitment: string;
  try {
    commitment = Identity.import(secret.trim()).commitment.toString();
  } catch {
    throw new PassError("pass.err.badBackup");
  }
  const { members } = await apiFetch<{ members: string[] }>("GET", "/api/passes/group");
  if (!members.includes(commitment)) throw new PassError("pass.err.unknown");
  window.localStorage.setItem(STORAGE_KEY, secret.trim());
  notify();
}

// --- Rejoindre, prouver, inviter -------------------------------------------

/** Crée un pass sur cet appareil avec une invitation reçue d'un membre. */
export async function joinWithInvitation(invitation: string): Promise<void> {
  if (hasPass()) throw new PassError("pass.err.alreadyHere");
  const { Identity } = await lib();
  const id = new Identity();
  try {
    await apiFetch("POST", "/api/passes/redeem", {
      invitation: invitation.trim(),
      commitment: id.commitment.toString(),
    });
  } catch (e) {
    if (e instanceof ApiError && e.code === "invalid_invitation") {
      throw new PassError("pass.err.invalidInvitation");
    }
    if (e instanceof ApiError && e.code === "already_member") {
      throw new PassError("pass.err.alreadyMember");
    }
    throw new PassError("pass.err.createFailed");
  }
  window.localStorage.setItem(STORAGE_KEY, id.export());
  notify();
}

/**
 * Preuve anonyme : « j'ai un pass » + un code propre à `scope`, avec un
 * `message` scellé (ex. seuil personnel). Calculée sur l'appareil.
 */
export async function proveWithPass(scope: string, message: number | string = 0) {
  const [{ Group }, { generateProofSingleThread }, id] = await Promise.all([
    lib(),
    prover(),
    identity(),
  ]);
  const { members } = await apiFetch<{ members: string[] }>("GET", "/api/passes/group");
  const group = new Group(members.map(BigInt));
  const origin = window.location.origin;
  return generateProofSingleThread(id, group, message, scope, PROOF_DEPTH, {
    wasm: `${origin}/zk/semaphore-20.wasm`,
    zkey: `${origin}/zk/semaphore-20.zkey`,
  });
}

const month = () => new Date().toISOString().slice(0, 7);

function usedSlots(): number[] {
  try {
    const raw = window.localStorage.getItem(SLOTS_KEY);
    const data = raw ? (JSON.parse(raw) as { month: string; used: number[] }) : null;
    return data?.month === month() ? data.used : [];
  } catch {
    return [];
  }
}

function markSlot(slot: number) {
  const used = [...new Set([...usedSlots(), slot])];
  window.localStorage.setItem(SLOTS_KEY, JSON.stringify({ month: month(), used }));
}

/** Invitations encore disponibles ce mois-ci (d'après cet appareil). */
export function remainingInvites(perMonth: number): number {
  return Math.max(0, perMonth - usedSlots().length);
}

/**
 * Crée une invitation (lien à envoyer soi-même, ex. par Signal). Le serveur
 * vérifie anonymement qu'un membre l'a demandée et applique le quota mensuel,
 * sans savoir quel membre. Le code est dans la partie « # » du lien : il
 * n'est jamais envoyé au serveur qui sert la page.
 */
export async function createInvitation(perMonth: number): Promise<string> {
  for (let slot = 1; slot <= perMonth; slot += 1) {
    if (usedSlots().includes(slot)) continue;
    const proof = await proveWithPass(`invite:${month()}:${slot}`, 0);
    try {
      const r = await apiFetch<{ invitation: string }>("POST", "/api/passes/invitations", {
        slot,
        proof,
      });
      markSlot(slot);
      return invitationLink(r.invitation);
    } catch (e) {
      // Emplacement déjà utilisé (autre appareil, données effacées) : suivant.
      if (e instanceof ApiError && e.code === "slot_used") {
        markSlot(slot);
        continue;
      }
      throw new PassError("pass.err.inviteFailed");
    }
  }
  throw new PassError("pass.err.noInvitesLeft");
}

/**
 * Lien d'invitation : le code va après un « # » (jamais envoyé au serveur).
 * Version statique (adresses en « #/… ») : …/#/pass#code ; sinon …/pass#code.
 */
export function invitationLink(code: string): string {
  const { origin, pathname, hash } = window.location;
  return hash.startsWith("#/") ? `${origin}${pathname}#/pass#${code}` : `${origin}/pass#${code}`;
}

/**
 * Code d'invitation reçu dans l'adresse de la page « Mon pass », et l'adresse
 * à garder une fois le code effacé ; null s'il n'y en a pas.
 */
export function invitationFromLocation(loc: {
  pathname: string;
  hash: string;
}): { code: string; cleanUrl: string } | null {
  if (loc.hash.startsWith("#/")) {
    // Version statique : « #/pass » est la page, le code vient après un second « # ».
    const [, route, code] = loc.hash.split("#");
    return code ? { code, cleanUrl: `${loc.pathname}#${route}` } : null;
  }
  const code = loc.hash.slice(1);
  return code ? { code, cleanUrl: loc.pathname } : null;
}
