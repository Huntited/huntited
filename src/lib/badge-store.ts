// Stockage local lié aux badges (mock) : partages et visibilité.
// Indexé par une empreinte pseudonyme du wallet, jamais par l'adresse brute.
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

export const BADGE_VISIBILITY_KEY = "huntited:badge-visibility";
export const SHARES_KEY = "huntited:shares";
const CHANGE_EVENT = "huntited:badges-changed";

export type BadgeVisibility = "private" | "public";

const isBrowser = () => typeof window !== "undefined";

/** Empreinte pseudonyme du wallet pour les badges. */
export function badgeWalletKey(address: string): string {
  return bytesToHex(sha256(utf8ToBytes(`huntited:badges|${address}`)));
}

function read(key: string): Record<string, unknown> {
  if (!isBrowser()) return {};
  try {
    const v: unknown = JSON.parse(window.localStorage.getItem(key) ?? "{}");
    return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function write(key: string, value: Record<string, unknown>) {
  if (!isBrowser()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Visibilité des badges de ce wallet : privée par défaut. */
export function getBadgeVisibility(address: string): BadgeVisibility {
  return read(BADGE_VISIBILITY_KEY)[badgeWalletKey(address)] === "public" ? "public" : "private";
}

export function setBadgeVisibility(address: string, visibility: BadgeVisibility): void {
  const all = read(BADGE_VISIBILITY_KEY);
  all[badgeWalletKey(address)] = visibility;
  write(BADGE_VISIBILITY_KEY, all);
}

/** Note qu'un wallet a partagé une chasse (badge Messager·ère). */
export function recordShare(address: string, huntId: string): void {
  const all = read(SHARES_KEY);
  const key = badgeWalletKey(address);
  const list = Array.isArray(all[key]) ? (all[key] as string[]) : [];
  if (list.includes(huntId)) return;
  all[key] = [...list, huntId];
  write(SHARES_KEY, all);
}

export function getSharedHuntIds(address: string): string[] {
  const list = read(SHARES_KEY)[badgeWalletKey(address)];
  return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : [];
}

export function subscribeBadges(listener: () => void): () => void {
  if (!isBrowser()) return () => {};
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}
