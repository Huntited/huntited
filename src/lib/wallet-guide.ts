// Conseils « compte dédié » (voir docs/registre-kaspa.md) :
// - fenêtre affichée avant la première connexion de Kastle ;
// - vérification, après connexion, que l'adresse n'a pas servi ailleurs.
import { hasBuiltinWallet } from "./builtin-wallet";
import { apiFetch, hasBackend } from "./api-client";
import { getDataMode } from "./hunt-repository";
import { getWalletMode } from "./wallet";

const SEEN_KEY = "huntited:wallet-guide";
const CHECKED_KEY = "huntited:address-checked";

type GuideMode = "connect" | "info";
interface GuideState {
  open: boolean;
  mode: GuideMode;
}

let guide: GuideState = { open: false, mode: "info" };
let pending: ((go: boolean) => void) | null = null;
const listeners = new Set<(s: GuideState) => void>();

function set(next: GuideState) {
  guide = next;
  listeners.forEach((fn) => fn(guide));
}

export function subscribeGuide(fn: (s: GuideState) => void): () => void {
  listeners.add(fn);
  fn(guide);
  return () => listeners.delete(fn);
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* stockage indisponible : les conseils se réafficheront, sans gravité */
  }
}

/** Avant la première connexion de Kastle : montrer les conseils. */
export function needsGuide(): boolean {
  // Wallet intégré, ou pas d'extension : pas de conseils Kastle.
  if (hasBuiltinWallet() || typeof window === "undefined" || !("kastle" in window)) return false;
  return getWalletMode() === "kastle" && read(SEEN_KEY) === null;
}

/** Affiche les conseils avant de connecter ; résout true si la personne continue. */
export function guideBeforeConnect(): Promise<boolean> {
  pending?.(false);
  set({ open: true, mode: "connect" });
  return new Promise((resolve) => {
    pending = resolve;
  });
}

/** Affiche les conseils seuls (depuis l'avertissement). */
export function showGuide(): void {
  set({ open: true, mode: "info" });
}

export function closeGuide(go: boolean): void {
  if (go) write(SEEN_KEY, "1");
  pending?.(go);
  pending = null;
  set({ ...guide, open: false });
}

export type AddressCheck = { usedElsewhere: boolean; reasons: string[] } | null;

/**
 * Vérifie une fois par adresse si elle a servi hors de Huntited. Par le
 * serveur Huntited (l'API publique ne voit pas l'IP) ; rien n'est conservé.
 * null : pas de vérification (mode local, wallet factice, service indisponible).
 */
export async function checkAddressOnce(address: string): Promise<AddressCheck> {
  if (getDataMode() === "local" || getWalletMode() !== "kastle" || !hasBackend()) return null;
  if (!address.startsWith("kaspatest:")) return null;
  const checked = new Set((read(CHECKED_KEY) ?? "").split(",").filter(Boolean));
  if (checked.has(address)) return null;
  try {
    const r = await apiFetch<{ usedElsewhere: boolean; reasons: string[] }>(
      "POST",
      "/api/wallet/exposure",
      { address },
    );
    write(CHECKED_KEY, [...checked, address].slice(-20).join(","));
    return r;
  } catch {
    return null;
  }
}
