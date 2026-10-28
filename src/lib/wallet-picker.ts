// Fenêtre « Connecter un wallet » : la personne choisit son wallet (intégré,
// Kastle ou Kasperia) ; la promesse résout le choix, ou null si elle ferme.
import type { WalletChoice } from "./wallet";

let open = false;
let pending: ((choice: WalletChoice | null) => void) | null = null;
const listeners = new Set<(open: boolean) => void>();

function set(next: boolean) {
  open = next;
  listeners.forEach((fn) => fn(open));
}

export function subscribePicker(fn: (open: boolean) => void): () => void {
  listeners.add(fn);
  fn(open);
  return () => listeners.delete(fn);
}

/** Ouvre la fenêtre ; résout le wallet choisi, ou null. */
export function pickWallet(): Promise<WalletChoice | null> {
  pending?.(null);
  set(true);
  return new Promise((resolve) => {
    pending = resolve;
  });
}

export function closePicker(choice: WalletChoice | null): void {
  pending?.(choice);
  pending = null;
  set(false);
}
