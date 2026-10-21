// Veille des chats suivis (chasses sur la chaîne) : tant qu'une page
// Huntited est ouverte, un nouveau message d'un autre membre affiche une
// notification du navigateur (src/lib/chat-notify.ts). Rien n'est affiché à
// l'écran ; aucune donnée ne sort du navigateur, sauf la lecture des relais.
import { useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import {
  followedChats,
  onChatNotifyChange,
  shouldNotify,
  showChatNotification,
} from "@/lib/chat-notify";
import { createRelayPool, nostrRelays } from "@/lib/nostr-relays";
import { getChainChat } from "@/lib/onchain/browser-index";
import { CHAT_KIND, chatPublicKey, chatTopic, getChatKey, openMessage } from "@/lib/p2p-chat";

export function ChatWatcher() {
  const router = useRouter();
  const [followed, setFollowed] = useState<Record<string, string>>({});

  useEffect(() => {
    const read = () => setFollowed(followedChats());
    read();
    window.addEventListener("storage", read);
    const stop = onChatNotifyChange(read);
    return () => {
      window.removeEventListener("storage", read);
      stop();
    };
  }, []);

  const ids = Object.keys(followed).sort().join();
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
        stops.push(
          // Seulement les messages arrivés après l'ouverture de la page.
          pool.subscribe({ kinds: [CHAT_KIND], "#h": [chatTopic(id)], since }, (e) => {
            if (e.pubkey === me || !shouldNotify(id)) return;
            void openMessage(id, priv, chat.members, e).then((m) => {
              if (!m || cancelled) return;
              const loc = router.buildLocation({ to: "/hunt/$id", params: { id } });
              const url = new URL(router.history.createHref(loc.href), window.location.href).href;
              void showChatNotification(
                id,
                followed[id] ?? "",
                url,
                () => void router.navigate({ to: "/hunt/$id", params: { id } }),
              );
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
    // `followed` : seuls les identifiants suivis décident d'une nouvelle veille.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, router]);

  return null;
}
