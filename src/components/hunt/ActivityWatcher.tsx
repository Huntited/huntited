// Veille de tes chasses sur la chaîne (créées ou rejointes depuis ce
// navigateur), tant qu'une page Huntited est ouverte :
// - chasse déclenchée ou non déclenchée → cloche de l'en-tête (src/lib/inbox.ts) ;
// - nouveau message d'un autre membre → cloche, et notification du navigateur
//   si « Me prévenir » est activé pour ce chat (src/lib/chat-notify.ts).
// Rien n'est affiché ici ; aucune donnée ne sort du navigateur, sauf la
// lecture de la blockchain et des relais.
import { useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { followedChats, shouldNotify, showChatNotification } from "@/lib/chat-notify";
import { addInboxItem, noteHuntState } from "@/lib/inbox";
import { createRelayPool, nostrRelays } from "@/lib/nostr-relays";
import { getChainChat, getChainHunt } from "@/lib/onchain/browser-index";
import {
  CHAT_KIND,
  CHAT_TTL_AFTER_DEADLINE_MS,
  chatKeyHunts,
  chatPublicKey,
  chatTopic,
  getChatKey,
  openMessage,
} from "@/lib/p2p-chat";

const CHECK_EVERY_MS = 60_000;

export function ActivityWatcher() {
  const router = useRouter();
  const [ids, setIds] = useState("");

  // Tes chasses, et leur état (relu chaque minute).
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const mine = chatKeyHunts().sort();
      if (!cancelled) setIds(mine.join());
      for (const id of mine) {
        const h = await getChainHunt(id).catch(() => null);
        if (cancelled || !h) continue;
        const state =
          h.status === "activated" || h.outcome === "success"
            ? "activated"
            : (h.status === "settled" && h.outcome === "failure") || h.status === "expired"
              ? "failed"
              : "active";
        const kind = noteHuntState(id, state);
        if (kind) addInboxItem({ huntId: id, kind, title: h.title, at: Date.now() });
      }
    };
    void check();
    const timer = setInterval(() => void check(), CHECK_EVERY_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  // Nouveaux messages des chats ouverts.
  useEffect(() => {
    if (!ids) return;
    const pool = createRelayPool(nostrRelays());
    let cancelled = false;
    const stops: (() => void)[] = [];
    const since = Math.floor(Date.now() / 1000);
    for (const id of ids.split(",")) {
      const priv = getChatKey(id);
      if (!priv) continue;
      const me = chatPublicKey(priv);
      void getChainChat(id).then((chat) => {
        if (cancelled || !chat || !chat.members.includes(me)) return;
        if (Date.now() > chat.deadline + CHAT_TTL_AFTER_DEADLINE_MS) return;
        stops.push(
          // Seulement les messages arrivés après l'ouverture de la page.
          pool.subscribe({ kinds: [CHAT_KIND], "#h": [chatTopic(id)], since }, (e) => {
            if (e.pubkey === me || !shouldNotify(id)) return;
            void openMessage(id, priv, chat.members, e).then((m) => {
              // Les messages cachés (clé de présence) ne sont pas des nouveaux messages.
              if (!m || cancelled || (!m.text && !m.audio)) return;
              addInboxItem({ huntId: id, kind: "message", title: chat.title, at: m.at });
              if (!(id in followedChats())) return;
              const loc = router.buildLocation({ to: "/hunt/$id", params: { id } });
              const url = new URL(router.history.createHref(loc.href), window.location.href).href;
              void showChatNotification(id, chat.title, url, () => {
                void router.navigate({ to: "/hunt/$id", params: { id } });
              });
            });
          }),
        );
      });
    }
    return () => {
      cancelled = true;
      stops.forEach((s) => s());
      pool.close();
    };
  }, [ids, router]);

  return null;
}
