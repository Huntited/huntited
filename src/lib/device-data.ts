// « Tes données » : tout ce que Huntited garde dans ce navigateur, regroupé
// et expliqué, avec export et effacement. Lit uniquement les clés
// « huntited:… » du stockage local : rien n'est envoyé nulle part.
import { isFollowing, unfollowHunt } from "./push";

const PREFIX = "huntited:";

export type DataGroupId =
  "wallet" | "pass" | "chat" | "inbox" | "hunts" | "draft" | "notify" | "prefs" | "demo" | "other";

/** Ordre d'affichage et clés de chaque groupe. */
const GROUPS: { id: DataGroupId; keys: string[] }[] = [
  { id: "wallet", keys: ["wallet", "mock-wallet", "wallet-guide", "address-checked"] },
  { id: "pass", keys: ["pass", "pass-invite-slots"] },
  { id: "chat", keys: ["chat-keys", "chat-names"] },
  { id: "inbox", keys: ["inbox", "hunt-seen"] },
  {
    id: "hunts",
    keys: [
      "user-hunts",
      "my-commitments",
      "mock-commitments",
      "mock-commitment-records",
      "local-secrets",
    ],
  },
  { id: "draft", keys: ["create-hunt-draft"] },
  { id: "notify", keys: ["push", "chat-notify"] },
  { id: "prefs", keys: ["locale", "theme", "badge-visibility", "shares"] },
  {
    id: "demo",
    keys: ["mock-created-hunts", "mock-hunt-states", "mock-chat-rooms", "mock-settled-hunts"],
  },
];

/** Groupes dont le contenu n'est pas affiché à l'écran (secret). */
export const SECRET_GROUPS: DataGroupId[] = ["pass", "chat"];

export interface DataGroup {
  id: DataGroupId;
  entries: { key: string; value: string }[];
  /** Taille approximative, en octets. */
  bytes: number;
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function huntitedKeys(s: Storage): string[] {
  const keys: string[] = [];
  for (let i = 0; i < s.length; i++) {
    const k = s.key(i);
    if (k?.startsWith(PREFIX)) keys.push(k);
  }
  return keys.sort();
}

/** Données présentes sur cet appareil, regroupées (groupes vides omis). */
export function readDeviceData(): DataGroup[] {
  const s = storage();
  if (!s) return [];
  const byGroup = new Map<DataGroupId, DataGroup>();
  for (const key of huntitedKeys(s)) {
    const short = key.slice(PREFIX.length);
    const id = GROUPS.find((g) => g.keys.includes(short))?.id ?? "other";
    const value = s.getItem(key) ?? "";
    const group = byGroup.get(id) ?? { id, entries: [], bytes: 0 };
    group.entries.push({ key, value });
    group.bytes += key.length + value.length;
    byGroup.set(id, group);
  }
  const order: DataGroupId[] = [...GROUPS.map((g) => g.id), "other"];
  return order.flatMap((id) => byGroup.get(id) ?? []);
}

/** Valeur lisible : JSON indenté si possible, sinon le texte brut. */
export function prettyValue(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

/** Contenu du fichier d'export (JSON lisible, daté). */
export function exportDeviceData(now: Date = new Date()): string {
  const data: Record<string, unknown> = {};
  for (const g of readDeviceData()) {
    for (const { key, value } of g.entries) {
      try {
        data[key] = JSON.parse(value);
      } catch {
        data[key] = value;
      }
    }
  }
  return JSON.stringify({ app: "Huntited", exportedAt: now.toISOString(), data }, null, 2);
}

/** Télécharge l'export (fichier créé dans le navigateur). */
export function downloadDeviceData(): void {
  const blob = new Blob([exportDeviceData()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `huntited-donnees-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Efface tout ce que Huntited garde dans ce navigateur : stockage local,
 * abonnements aux notifications (aussi retirés du serveur) et service worker.
 */
export async function eraseDeviceData(): Promise<void> {
  const s = storage();
  if (!s) return;
  // Notifications : se désabonner côté serveur tant qu'on connaît les chasses.
  try {
    const followed = JSON.parse(s.getItem(`${PREFIX}push`) ?? "[]") as unknown;
    if (Array.isArray(followed)) {
      await Promise.all(
        followed
          .filter((id): id is string => typeof id === "string" && isFollowing(id))
          .map((id) => unfollowHunt(id)),
      );
    }
  } catch {
    /* le serveur les oubliera de toute façon à la fin des chasses */
  }
  try {
    const reg = await navigator.serviceWorker?.getRegistration("/sw.js");
    await reg?.unregister();
  } catch {
    /* pas de service worker */
  }
  for (const key of huntitedKeys(s)) s.removeItem(key);
}
