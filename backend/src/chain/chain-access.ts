// Accès au chat pour les chasses inscrites sur la chaîne : même interface que
// le registre du serveur. Le wallet est reconnu par son empreinte (session
// signée), comparée à celle des adresses qui ont créé ou rejoint la chasse.
import { fingerprintWallet } from "../services/auth-service.js";
import type { HuntAccessStore } from "../services/hunt-access-store.js";
import type { ChatRole, HuntAccessStatus, HuntOutcome } from "../types/auth.js";
import type { Ledger, LedgerHunt } from "./ledger.js";

const ADDRESS_PREFIX = "a:";
const fingerprintOf = (who: string) =>
  who.startsWith(ADDRESS_PREFIX) ? fingerprintWallet(who.slice(ADDRESS_PREFIX.length)) : null;

/** `getLedger` : le grand livre courant (l'index peut le recalculer). */
export function chainAccess(
  getLedger: () => Ledger,
  now: () => number = Date.now,
): HuntAccessStore {
  const state = (h: LedgerHunt) => getLedger().status(h, now());
  return {
    getHuntStatus(id): HuntAccessStatus | undefined {
      const h = getLedger().hunt(id);
      if (!h) return undefined;
      const s = state(h);
      return s.outcome ? "settled" : s.status;
    },
    getHuntOutcome(id): HuntOutcome | undefined {
      const h = getLedger().hunt(id);
      return h ? state(h).outcome : undefined;
    },
    getWalletRole(id, walletKey): ChatRole | undefined {
      const ledger = getLedger();
      const h = ledger.hunt(id);
      if (!h) return undefined;
      if (fingerprintOf(h.creator) === walletKey) return "creator";
      const mine = h.commits.find((c) => fingerprintOf(c.who) === walletKey);
      return mine ? ledger.roleOf(id, mine.who) : undefined;
    },
  };
}

/** Le premier magasin qui connaît la chasse répond (registre du serveur, puis chaîne). */
export function combineAccess(...stores: HuntAccessStore[]): HuntAccessStore {
  const pick = (id: string) => stores.find((s) => s.getHuntStatus(id) !== undefined);
  return {
    getHuntStatus: (id) => pick(id)?.getHuntStatus(id),
    getHuntOutcome: (id) => pick(id)?.getHuntOutcome(id),
    getWalletRole: (id, key) => pick(id)?.getWalletRole(id, key),
  };
}
