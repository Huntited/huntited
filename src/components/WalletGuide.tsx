// Conseils « compte dédié » : fenêtre avant la première connexion de Kastle,
// et avertissement discret si l'adresse connectée a déjà servi ailleurs.
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import { subscribeWallet } from "@/lib/wallet";
import { closeGuide, subscribeGuide } from "@/lib/wallet-guide";

export function WalletGuide() {
  const { t } = useI18n();
  const [state, setState] = useState<{ open: boolean; mode: "connect" | "info" }>({
    open: false,
    mode: "info",
  });
  useEffect(() => subscribeGuide(setState), []);

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && closeGuide(false)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("guide.title")}</DialogTitle>
          <DialogDescription>{t("guide.lead")}</DialogDescription>
        </DialogHeader>
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>{t("guide.step1")}</li>
          <li>{t("guide.step2")}</li>
          <li>{t("guide.step3")}</li>
        </ol>
        <p className="text-xs text-muted-foreground">{t("guide.note")}</p>
        <DialogFooter>
          {state.mode === "connect" ? (
            <>
              <Button variant="outline" onClick={() => closeGuide(false)}>
                {t("common.cancel")}
              </Button>
              <Button onClick={() => closeGuide(true)}>{t("guide.connect")}</Button>
            </>
          ) : (
            <Button onClick={() => closeGuide(false)}>{t("guide.close")}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
