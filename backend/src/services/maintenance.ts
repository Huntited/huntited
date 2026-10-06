// Tâches périodiques (toutes les minutes) :
// - fermer les salons de chat expirés ;
// - prévenir les abonné·es des chasses arrivées à leur fin (déclenchée, si
//   l'annonce immédiate a été manquée, ou ratée à la date limite) ;
// - effacer les engagements des chasses ratées, 24 h après la date limite.
import type { ChatService } from "./chat-service.js";
import type { HuntRegistry } from "./hunt-registry.js";
import type { PushService } from "./push-service.js";

/** Délai avant l'effacement des engagements d'une chasse ratée. */
export const FAILED_PURGE_AFTER_MS = 86_400_000;

export async function runMaintenance(d: {
  registry: HuntRegistry;
  chat: ChatService;
  push?: PushService;
  purgeAfterMs?: number;
}): Promise<void> {
  await d.chat.cleanExpiredChats().catch(() => console.error("[chat] cleanup_failed"));

  for (const id of d.push?.huntIds() ?? []) {
    const hunt = d.registry.get(id);
    if (!hunt) {
      d.push!.forget(id);
      continue;
    }
    const status = d.registry.status(hunt);
    if (d.registry.isFailed(hunt)) await d.push!.notify(hunt, "failed");
    else if (status !== "active") await d.push!.notify(hunt, "activated");
  }

  d.registry.purgeFailed(d.purgeAfterMs ?? FAILED_PURGE_AFTER_MS);
}
