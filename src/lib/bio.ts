// Empreinte ou visage, dans l'app Huntited Chat (docs/wallet.md) : l'app
// chiffre et déchiffre avec une clé gardée par la puce sécurisée du
// téléphone, utilisable seulement après empreinte ou visage. La page ne voit
// jamais cette clé.
interface BioApp {
  bioAvailable?: () => boolean;
  bioEncrypt?: (reqId: string, dataB64: string) => void;
  bioDecrypt?: (reqId: string, dataB64: string) => void;
}

type BioWindow = {
  HuntitedApp?: BioApp;
  __huntitedBio?: (reqId: string, ok: boolean, result: string) => void;
};

function app(): BioApp | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as BioWindow).HuntitedApp ?? null;
}

export function bioAvailable(): boolean {
  try {
    return app()?.bioAvailable?.() === true;
  } catch {
    return false;
  }
}

const pending = new Map<string, { resolve: (s: string) => void; reject: (e: Error) => void }>();

function call(op: "bioEncrypt" | "bioDecrypt", dataB64: string): Promise<string> {
  const a = app();
  const fn = a?.[op];
  if (!fn) return Promise.reject(new Error("bio_unavailable"));
  const w = window as unknown as BioWindow;
  w.__huntitedBio ??= (reqId, ok, result) => {
    const p = pending.get(reqId);
    if (!p) return;
    pending.delete(reqId);
    if (ok) p.resolve(result);
    else p.reject(new Error(result || "bio_failed"));
  };
  const reqId = crypto.randomUUID();
  return new Promise<string>((resolve, reject) => {
    pending.set(reqId, { resolve, reject });
    try {
      fn.call(a, reqId, dataB64);
    } catch (e) {
      pending.delete(reqId);
      reject(e instanceof Error ? e : new Error("bio_failed"));
    }
  });
}

/** Chiffre (après empreinte ou visage). */
export const bioEncrypt = (dataB64: string) => call("bioEncrypt", dataB64);
/** Déchiffre (après empreinte ou visage). */
export const bioDecrypt = (dataB64: string) => call("bioDecrypt", dataB64);
