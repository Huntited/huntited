// Défis de connexion par signature (style « Sign-In with Ethereum », adapté à Kaspa).
// Le serveur rédige lui-même le message à signer : le client ne peut ni
// choisir le texte, ni rejouer un défi (usage unique, courte durée).
// Aucun log : ni adresse, ni message, ni signature.
import { randomBytes } from "node:crypto";

export interface Challenge {
  challengeId: string;
  walletAddress: string;
  huntId: string;
  message: string;
  expiresAt: number;
}

export interface ChallengeOptions {
  /** URI de l'application (domaine attendu par l'utilisateur). */
  appUri: string;
  /** Réseau Kaspa affiché dans le message, ex. "testnet-10". */
  network: string;
  ttlMs?: number;
  /** Plafond mémoire : au-delà, les plus anciens défis sont évincés. */
  maxPending?: number;
  now?: () => number;
}

export function buildChallengeMessage(c: {
  walletAddress: string;
  appUri: string;
  network: string;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
  huntId: string;
}): string {
  return [
    "Huntited wants you to sign in with your Kaspa account:",
    c.walletAddress,
    "",
    "Application: Huntited",
    `URI: ${c.appUri}`,
    `Network: kaspa:${c.network}`,
    `Nonce: ${c.nonce}`,
    `Issued At: ${new Date(c.issuedAt).toISOString()}`,
    `Expiration Time: ${new Date(c.expiresAt).toISOString()}`,
    `Purpose: Access Huntited chat for hunt ${c.huntId}`,
    "",
    "This signature does not send any KAS.",
  ].join("\n");
}

export class ChallengeService {
  private readonly pending = new Map<string, Challenge>();
  private readonly ttlMs: number;
  private readonly maxPending: number;
  private readonly now: () => number;

  constructor(private readonly options: ChallengeOptions) {
    this.ttlMs = options.ttlMs ?? 5 * 60_000;
    this.maxPending = options.maxPending ?? 10_000;
    this.now = options.now ?? Date.now;
  }

  issue(input: { walletAddress: string; huntId: string }): Challenge {
    this.purgeExpired();
    while (this.pending.size >= this.maxPending) {
      const oldest = this.pending.keys().next().value;
      if (oldest === undefined) break;
      this.pending.delete(oldest);
    }
    const issuedAt = this.now();
    const challengeId = randomBytes(16).toString("hex");
    const expiresAt = issuedAt + this.ttlMs;
    const challenge: Challenge = {
      challengeId,
      walletAddress: input.walletAddress,
      huntId: input.huntId,
      expiresAt,
      message: buildChallengeMessage({
        walletAddress: input.walletAddress,
        appUri: this.options.appUri,
        network: this.options.network,
        nonce: challengeId,
        issuedAt,
        expiresAt,
        huntId: input.huntId,
      }),
    };
    this.pending.set(challengeId, challenge);
    return challenge;
  }

  /**
   * Consomme un défi : il est retiré quoi qu'il arrive (usage unique, même
   * en cas d'échec de la vérification qui suit). Renvoie undefined s'il est
   * inconnu, expiré, ou ne correspond pas à l'adresse et à la chasse.
   */
  consume(input: { challengeId: string; walletAddress: string; huntId: string }) {
    const c = this.pending.get(input.challengeId);
    if (!c) return undefined;
    this.pending.delete(input.challengeId);
    if (c.expiresAt <= this.now()) return undefined;
    if (c.walletAddress !== input.walletAddress || c.huntId !== input.huntId) return undefined;
    return c;
  }

  private purgeExpired() {
    const t = this.now();
    for (const [id, c] of this.pending) if (c.expiresAt <= t) this.pending.delete(id);
  }
}
