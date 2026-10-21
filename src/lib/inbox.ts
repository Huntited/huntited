// Activité de tes chasses (cloche de l'en-tête) : nouveaux messages du chat,
// chasse déclenchée, chasse non déclenchée. Tout reste dans ce navigateur
// (huntited:inbox) ; rien n'est envoyé nulle part.

const STORAGE = "huntited:inbox";
const SEEN = "huntited:hunt-seen";
const MAX_ITEMS = 50;

export type InboxKind = "message" | "activated" | "failed";

export interface InboxItem {
  id: string;
  huntId: string;
  kind: InboxKind;
  /** Titre de la chasse au moment de l'événement. */
  title: string;
  at: number;
  read: boolean;
}

const listeners = new Set<() => void>();
export function onInboxChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function read<T>(key: string, fallback: T): T {
  try {
    return (JSON.parse(localStorage.getItem(key) ?? "null") as T | null) ?? fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* stockage indisponible : l'activité n'est pas gardée */
  }
}

export function inboxItems(): InboxItem[] {
  const items = read<unknown>(STORAGE, []);
  return Array.isArray(items)
    ? (items as InboxItem[]).filter(
        (i) => i && typeof i.id === "string" && typeof i.huntId === "string",
      )
    : [];
}

const save = (items: InboxItem[]) => {
  write(STORAGE, items.slice(0, MAX_ITEMS));
  listeners.forEach((fn) => fn());
};

export const unreadCount = () => inboxItems().filter((i) => !i.read).length;

/**
 * Ajoute un événement. Plusieurs messages non lus d'une même chasse ne font
 * qu'une ligne (la plus récente).
 */
export function addInboxItem(item: Omit<InboxItem, "read" | "id"> & { id?: string }): void {
  const id = item.id ?? `${item.kind}:${item.huntId}`;
  const rest = inboxItems().filter(
    (i) =>
      i.id !== id &&
      !(item.kind === "message" && i.kind === "message" && i.huntId === item.huntId && !i.read),
  );
  save([{ ...item, id, read: false }, ...rest].sort((a, b) => b.at - a.at));
}

export function markRead(filter?: { huntId: string; kind?: InboxKind }): void {
  const items = inboxItems();
  if (!items.some((i) => !i.read)) return;
  save(
    items.map((i) =>
      !filter || (i.huntId === filter.huntId && (!filter.kind || i.kind === filter.kind))
        ? { ...i, read: true }
        : i,
    ),
  );
}

export function clearInbox(): void {
  save([]);
}

/** Dernier état connu de chaque chasse suivie (pour repérer les changements). */
export type SeenState = "active" | "activated" | "failed";

/**
 * Enregistre l'état d'une de tes chasses ; renvoie l'événement à signaler
 * s'il a changé. Une chasse jamais vue était « en cours » (tu l'as créée ou
 * tu t'y es engagé·e depuis ce navigateur).
 */
export function noteHuntState(huntId: string, state: SeenState): InboxKind | null {
  const seen = read<Record<string, SeenState>>(SEEN, {});
  const before = seen[huntId] ?? "active";
  if (seen[huntId] === state) return null;
  write(SEEN, { ...seen, [huntId]: state });
  if (before === state) return null;
  return state === "activated" ? "activated" : state === "failed" ? "failed" : null;
}
