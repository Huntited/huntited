import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { recordShare } from "@/lib/badge-store";
import { huntShareUrl } from "@/lib/share";
import { getWalletState } from "@/lib/wallet";
import type { Hunt } from "@/lib/types";

/**
 * Partage d'une chasse : feuille de partage native (mobile) si disponible,
 * sinon copie du lien dans le presse-papiers.
 */
export function ShareHuntButton({ hunt }: { hunt: Pick<Hunt, "id" | "title"> }) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const url = huntShareUrl(hunt.id, window.location.origin);
    // Badge Messager·ère : le partage est noté pour le wallet connecté (empreinte).
    const { address } = getWalletState();
    if (address) recordShare(address, hunt.id);
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: hunt.title, url });
        return;
      } catch (e) {
        // Partage annulé par l'utilisateur : rien à faire.
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Lien copié.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Impossible de copier le lien. Copie l'adresse de la page.");
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={() => void handleShare()}>
      {copied ? "Lien copié" : "Partager"}
    </Button>
  );
}
