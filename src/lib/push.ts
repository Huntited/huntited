// « Me prévenir » : notification du navigateur quand une chasse se déclenche
// ou échoue. Aucun compte ni wallet : le serveur ne reçoit que l'adresse de
// livraison du navigateur et l'id de la chasse, et l'oublie après l'envoi.
// Disponible seulement avec le registre partagé (VITE_DATA_MODE=api) et si
// le serveur a des clés de notification.
import { apiFetch } from "./api-client";
import { getDataMode } from "./hunt-repository";
import type { Locale } from "./i18n";

/** Chasses suivies sur cet appareil (pour afficher l'état du bouton). */
const KEY = "huntited:push";

function readFollowed(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeFollowed(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids.slice(-200)));
  } catch {
    /* stockage indisponible : le bouton ne se souviendra pas, sans gravité */
  }
}

export function isFollowing(huntId: string): boolean {
  return readFollowed().includes(huntId);
}

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

let keyPromise: Promise<string | null> | null = null;

/** Clé publique du serveur, ou null si les notifications sont indisponibles. */
export function getPushKey(): Promise<string | null> {
  if (getDataMode() !== "api" || !isPushSupported()) return Promise.resolve(null);
  keyPromise ??= apiFetch<{ publicKey?: string }>("GET", "/api/push/key")
    .then((r) => r.publicKey || null)
    .catch(() => {
      keyPromise = null;
      return null;
    });
  return keyPromise;
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const b64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export type FollowResult = "ok" | "denied" | "unavailable";

/** Demande la permission puis s'abonne à la chasse. */
export async function followHunt(huntId: string, locale: Locale): Promise<FollowResult> {
  const publicKey = await getPushKey();
  if (!publicKey) return "unavailable";
  if ((await Notification.requestPermission()) !== "granted") return "denied";
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(publicKey),
      }));
    await apiFetch("POST", "/api/push/subscribe", {
      huntId,
      subscription: sub.toJSON(),
      locale,
    });
  } catch {
    return "unavailable";
  }
  writeFollowed([...readFollowed().filter((id) => id !== huntId), huntId]);
  return "ok";
}

export async function unfollowHunt(huntId: string): Promise<void> {
  writeFollowed(readFollowed().filter((id) => id !== huntId));
  try {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await apiFetch("POST", "/api/push/unsubscribe", { huntId, endpoint: sub.endpoint });
    }
  } catch {
    /* le serveur l'oubliera de toute façon après la fin de la chasse */
  }
}
