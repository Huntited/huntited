// Entrée « salon » (app Huntited Chat) : enregistre la clé de chat reçue par
// le lien, puis ouvre la chasse et son chat. La clé n'est envoyée nulle part.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { useI18n } from "@/lib/i18n";
import { importChatKey } from "@/lib/p2p-chat";

export const Route = createFileRoute("/room/$hunt/$key")({
  head: () => ({ meta: [{ title: "Salon — Huntited" }, { name: "robots", content: "noindex" }] }),
  component: RoomPage,
});

function RoomPage() {
  const { hunt, key } = Route.useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    if (!importChatKey(hunt, key)) return setInvalid(true);
    void navigate({ to: "/hunt/$id", params: { id: hunt }, replace: true });
  }, [hunt, key, navigate]);
  return (
    <div className="mx-auto max-w-xl px-4 py-10 text-sm text-muted-foreground">
      <p role="status">{invalid ? t("place.invalid") : t("chat.p2p.loading")}</p>
    </div>
  );
}
