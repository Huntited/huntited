// Déverrouillage du wallet intégré (src/lib/builtin-wallet.ts) : fenêtre
// ouverte quand une opération a besoin de la clé (engagement, phrase,
// changement de protection). Code, empreinte ou visage, ou les deux.
import { Fingerprint } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  builtinProtection,
  setUnlockHandler,
  unlockBuiltin,
  unlockWaitSeconds,
  type Protection,
} from "@/lib/builtin-wallet";
import { useI18n, type MessageKey } from "@/lib/i18n";

export function WalletUnlock() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [prot, setProt] = useState<Protection | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const [wait, setWait] = useState(0);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  useEffect(() => {
    setUnlockHandler(
      () =>
        new Promise<boolean>((resolve) => {
          resolver.current?.(false);
          resolver.current = resolve;
          setProt(builtinProtection());
          setCode("");
          setError(null);
          setWait(unlockWaitSeconds());
          setOpen(true);
        }),
    );
    return () => setUnlockHandler(null);
  }, []);

  // Compte à rebours après trop d'essais.
  useEffect(() => {
    if (!open || wait <= 0) return;
    const timer = setInterval(() => setWait(unlockWaitSeconds()), 1000);
    return () => clearInterval(timer);
  }, [open, wait]);

  const finish = (ok: boolean) => {
    setOpen(false);
    resolver.current?.(ok);
    resolver.current = null;
  };

  async function submit() {
    setBusy(true);
    setError(null);
    const r = await unlockBuiltin(code);
    setBusy(false);
    if (r === "ok") return finish(true);
    if (r === "wiped") {
      setError("wallet.unlock.wiped");
      setTimeout(() => finish(false), 2500);
      return;
    }
    setError(
      r === "bad"
        ? "wallet.unlock.bad"
        : r === "wait"
          ? "wallet.unlock.wait"
          : "wallet.unlock.cancelled",
    );
    setCode("");
    setWait(unlockWaitSeconds());
  }

  const needsCode = prot?.code != null;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && finish(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("wallet.unlock.title")}</DialogTitle>
          <DialogDescription>
            {t(
              needsCode && prot?.bio
                ? "wallet.unlock.both"
                : prot?.bio
                  ? "wallet.unlock.bioOnly"
                  : "wallet.unlock.codeOnly",
            )}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!busy && wait <= 0) void submit();
          }}
        >
          {needsCode && (
            <Input
              type="password"
              inputMode={prot?.code === "pin" ? "numeric" : "text"}
              autoComplete="off"
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              aria-label={t(prot?.code === "pin" ? "wallet.lock.pin" : "wallet.lock.password")}
              placeholder={t(prot?.code === "pin" ? "wallet.lock.pin" : "wallet.lock.password")}
            />
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {t(error, { s: wait })}
            </p>
          )}
          {wait > 0 && !error && (
            <p role="status" className="text-sm text-muted-foreground">
              {t("wallet.unlock.wait", { s: wait })}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => finish(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={busy || wait > 0 || (needsCode && code.length === 0)}>
              {prot?.bio && <Fingerprint aria-hidden />}
              {busy ? t("wallet.unlock.busy") : t("wallet.unlock.button")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
