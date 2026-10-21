// Notifications de nouveaux messages du chat chiffré (sans serveur).
// Tant qu'une page Huntited est ouverte (même en arrière-plan), un nouveau
// message d'un autre membre d'une chasse suivie affiche une notification du
// navigateur. Sans serveur, rien n'arrive quand le site est fermé.
// La notification ne contient jamais le texte du message (écran verrouillé).
import { getLocale, translate } from "./i18n";

const STORAGE = "huntited:chat-notify";

/** Chasses dont on veut être prévenu·e : identifiant → titre (affiché dans la notification). */
type Followed = Record<string, string>;

const listeners = new Set<() => void>();
const changed = () => listeners.forEach((fn) => fn());

export function onChatNotifyChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function chatNotifySupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function followedChats(): Followed {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE) ?? "{}") as unknown;
    if (!raw || typeof raw !== "object") return {};
    return Object.fromEntries(
      Object.entries(raw).filter(
        ([id, title]) => /^[0-9a-f]{24}$/.test(id) && typeof title === "string",
      ),
    ) as Followed;
  } catch {
    return {};
  }
}

const save = (f: Followed) => {
  try {
    localStorage.setItem(STORAGE, JSON.stringify(f));
  } catch {
    /* préférence non mémorisée */
  }
  changed();
};

export const isChatNotifyOn = (huntId: string) =>
  chatNotifySupported() && Notification.permission === "granted" && huntId in followedChats();

/** Active les notifications d'un chat (demande l'autorisation du navigateur). */
export async function enableChatNotify(
  huntId: string,
  title: string,
): Promise<"on" | "denied" | "unsupported"> {
  if (!chatNotifySupported()) return "unsupported";
  const permission =
    Notification.permission === "default"
      ? await Notification.requestPermission()
      : Notification.permission;
  if (permission !== "granted") return "denied";
  save({ ...followedChats(), [huntId]: title.slice(0, 80) });
  return "on";
}

export function disableChatNotify(huntId: string): void {
  const { [huntId]: _gone, ...rest } = followedChats();
  save(rest);
}

// Chat affiché à l'écran en ce moment : pas de notification pour lui.
let visibleChat: string | null = null;
export function setVisibleChat(huntId: string | null): void {
  visibleChat = huntId;
}
export const shouldNotify = (huntId: string) =>
  typeof document === "undefined" || document.hidden || visibleChat !== huntId;

/** Affiche la notification « nouveau message » ; un clic ouvre la chasse. */
export async function showChatNotification(
  huntId: string,
  title: string,
  /** Adresse complète de la page de la chasse. */
  url: string,
  open: () => void,
): Promise<void> {
  if (!chatNotifySupported() || Notification.permission !== "granted") return;
  const locale = getLocale();
  const heading = translate(locale, "chat.notify.title");
  const options = {
    body: translate(locale, "chat.notify.body", { title }),
    icon: "./favicon.svg",
    // Une seule notification par chasse : la suivante remplace la précédente.
    tag: `chat-${huntId}`,
  };
  try {
    const n = new Notification(heading, options);
    n.onclick = () => {
      window.focus();
      open();
      n.close();
    };
  } catch {
    // Android : notifications seulement par le service worker.
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.showNotification(heading, { ...options, data: { url } });
  }
}
