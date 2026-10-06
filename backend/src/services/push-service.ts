// Notifications « me prévenir » (Web Push), sans compte ni wallet.
//
// Un navigateur s'abonne à UNE chasse : on garde seulement l'adresse de
// livraison fournie par le navigateur (endpoint + clés de chiffrement), la
// chasse et la langue. Aucun lien avec un wallet, un pass ou un engagement.
// Le message est chiffré de bout en bout (RFC 8291) : le service de push du
// navigateur (Google, Mozilla, Apple) le transporte sans pouvoir le lire.
//
// Les deux événements notifiés sont définitifs (déclenchée / ratée) : après
// l'envoi, les abonnements de la chasse sont supprimés.
// Logs : événements anonymes uniquement, jamais d'endpoint.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export interface PushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export type PushLocale = "fr" | "en";
export type PushKind = "activated" | "failed";

interface StoredSubscription extends PushSubscription {
  locale: PushLocale;
}

/** Contenu chiffré envoyé au navigateur (le service worker compose le texte). */
export interface PushPayload {
  huntId: string;
  kind: PushKind;
  title: string;
  locale: PushLocale;
}

/** Envoi d'un message chiffré ; lève une erreur en cas d'échec. */
export type PushSender = (sub: PushSubscription, payload: string) => Promise<void>;

/** Abonnements max. par chasse (limite les abus). */
export const MAX_SUBSCRIPTIONS_PER_HUNT = 10_000;

const logEvent = (name: string) => console.info(`[push] ${name}`);

export class PushService {
  private readonly subs = new Map<string, StoredSubscription[]>();

  constructor(
    private readonly send: PushSender,
    private readonly options: { file?: string } = {},
  ) {
    this.load();
  }

  subscribe(huntId: string, sub: PushSubscription, locale: PushLocale): boolean {
    const list = (this.subs.get(huntId) ?? []).filter((s) => s.endpoint !== sub.endpoint);
    if (list.length >= MAX_SUBSCRIPTIONS_PER_HUNT) return false;
    list.push({ endpoint: sub.endpoint, keys: sub.keys, locale });
    this.subs.set(huntId, list);
    this.save();
    return true;
  }

  unsubscribe(huntId: string, endpoint: string): void {
    const list = this.subs.get(huntId);
    if (!list) return;
    const rest = list.filter((s) => s.endpoint !== endpoint);
    if (rest.length) this.subs.set(huntId, rest);
    else this.subs.delete(huntId);
    this.save();
  }

  /** Chasses ayant au moins un abonnement. */
  huntIds(): string[] {
    return [...this.subs.keys()];
  }

  count(huntId: string): number {
    return this.subs.get(huntId)?.length ?? 0;
  }

  /** Prévient tous les abonné·es d'une chasse, puis oublie leurs abonnements. */
  async notify(hunt: { id: string; title: string }, kind: PushKind): Promise<number> {
    const list = this.subs.get(hunt.id);
    if (!list?.length) return 0;
    // Retiré avant l'envoi : un second appel (job périodique) ne renvoie rien.
    this.subs.delete(hunt.id);
    this.save();
    let sent = 0;
    await Promise.all(
      list.map(async (s) => {
        const payload: PushPayload = {
          huntId: hunt.id,
          kind,
          title: hunt.title.slice(0, 80),
          locale: s.locale,
        };
        try {
          await this.send(s, JSON.stringify(payload));
          sent++;
        } catch {
          // Abonnement expiré ou service indisponible : rien à retenter.
          logEvent("send_failed");
        }
      }),
    );
    logEvent(`notified_${kind}`);
    return sent;
  }

  /** Oublie tous les abonnements d'une chasse (ex. chasse effacée). */
  forget(huntId: string): void {
    if (this.subs.delete(huntId)) this.save();
  }

  private load() {
    const file = this.options.file;
    if (!file || !existsSync(file)) return;
    const data = JSON.parse(readFileSync(file, "utf8")) as Record<string, StoredSubscription[]>;
    for (const [id, list] of Object.entries(data)) this.subs.set(id, list);
  }

  private save() {
    const file = this.options.file;
    if (!file) return;
    mkdirSync(dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    writeFileSync(tmp, JSON.stringify(Object.fromEntries(this.subs)));
    renameSync(tmp, file); // écriture atomique
  }
}

/** Expéditeur réel (bibliothèque web-push, clés VAPID). */
export async function createWebPushSender(vapid: {
  publicKey: string;
  privateKey: string;
  subject: string;
}): Promise<PushSender> {
  const webpush = (await import("web-push")).default;
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
  return async (sub, payload) => {
    // TTL : un message non livré sous 24 h est abandonné ; urgence normale.
    await webpush.sendNotification(sub, payload, { TTL: 86_400, urgency: "normal" });
  };
}
