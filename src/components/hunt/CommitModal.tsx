import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/lib/i18n";
import { getPassConfig, hasPass, onPassChange } from "@/lib/pass";
import {
  commitDepositTerms,
  commitRefundHighlight,
  termsFullFor,
  termsShortFor,
} from "@/lib/terms";
import type { Hunt } from "@/lib/types";
import type { UseCommitmentResult } from "@/lib/useCommitment";

interface CommitModalProps {
  hunt: Hunt;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** État d'engagement fourni par la page (useCommitment). */
  commitment: UseCommitmentResult;
  /** Adresse du wallet connecté (affichée en forme courte uniquement). */
  walletAddress: string | null;
  onConnectWallet: () => void;
  walletLoading?: boolean;
  /** Appelé après un engagement réussi. */
  onCommitted?: () => void;
}

/** Forme courte d'une adresse : 6 premiers + 4 derniers caractères. */
export function shortAddress(address: string): string {
  // Le préfixe "kaspa:" n'est pas compté dans les 6 premiers caractères.
  const [prefix, body] = address.includes(":")
    ? (address.split(":", 2) as [string, string])
    : ["", address];
  const short = body.length <= 10 ? body : `${body.slice(0, 6)}…${body.slice(-4)}`;
  return prefix ? `${prefix}:${short}` : short;
}

/**
 * Modal de confirmation d'engagement (5 KAS simulés).
 * Les conditions doivent être acceptées ; un wallet ne s'engage qu'une fois.
 */
export function CommitModal({
  hunt,
  open,
  onOpenChange,
  commitment,
  walletAddress,
  onConnectWallet,
  walletLoading = false,
  onCommitted,
}: CommitModalProps) {
  const { t, date, locale } = useI18n();
  const [accepted, setAccepted] = useState(false);
  // Seuil personnel : « je viens si au moins N personnes viennent » (N ≥ seuil de la chasse).
  const [personal, setPersonal] = useState(String(hunt.threshold));
  const { isConnected, isCommitted, canCommit, isSubmitting, error, commit } = commitment;
  // Pass exigé par le serveur et absent de cet appareil.
  const [needsPass, setNeedsPass] = useState(false);
  useEffect(() => {
    const check = () => void getPassConfig().then((c) => setNeedsPass(c.required && !hasPass()));
    check();
    return onPassChange(check);
  }, []);
  const personalValue = Number(personal);
  const personalValid =
    Number.isInteger(personalValue) && personalValue >= hunt.threshold && personalValue <= 100_000;

  const handleConfirm = async () => {
    try {
      await commit(personalValue !== hunt.threshold ? personalValue : undefined);
      setAccepted(false);
      setPersonal(String(hunt.threshold));
      onCommitted?.();
    } catch {
      /* l'erreur est affichée via commitment.error */
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setAccepted(false);
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("commit.title", { amount: hunt.commitDeposit })}</DialogTitle>
          <DialogDescription>{hunt.title}</DialogDescription>
        </DialogHeader>

        {isCommitted ? (
          <p role="status" className="rounded-lg border bg-muted/40 p-4 text-sm">
            {t("commit.already")}
          </p>
        ) : (
          <>
            <p className="rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950 p-3 text-sm font-medium text-green-700 dark:text-green-400">
              {commitRefundHighlight(hunt.deposit, locale)}
            </p>
            <div className="space-y-2 rounded-lg border bg-muted/40 p-4 text-sm">
              <p>{commitDepositTerms(hunt.deposit, locale)}</p>
              <p className="text-xs text-muted-foreground">{t("commit.testNote")}</p>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">{t("hunt.deadline")}</span>
                <span className="font-medium">
                  {date(hunt.deadline, { dateStyle: "long", timeStyle: "short" })}
                </span>
              </div>
              {walletAddress && (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Wallet</span>
                  <code className="text-xs">{shortAddress(walletAddress)}</code>
                </div>
              )}
            </div>

            {/* Seuil personnel (facultatif) */}
            <div className="space-y-2 rounded-lg border p-4 text-sm">
              <label htmlFor="personal-threshold" className="flex items-center gap-2">
                <span>{t("commit.personal.before")}</span>
                <Input
                  id="personal-threshold"
                  type="number"
                  min={hunt.threshold}
                  step={1}
                  value={personal}
                  onChange={(e) => setPersonal(e.target.value)}
                  className="h-8 w-24"
                  aria-invalid={!personalValid}
                />
                <span>{t("commit.personal.after")}</span>
              </label>
              <p className="text-xs text-muted-foreground">
                {t("commit.personal.help", {
                  threshold: hunt.threshold,
                  amount: hunt.commitDeposit,
                })}
              </p>
              {!personalValid && (
                <p className="text-xs text-destructive" role="alert">
                  {t("commit.personal.invalid", { threshold: hunt.threshold })}
                </p>
              )}
            </div>
          </>
        )}

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">{t("commit.keyTerms")}</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {termsShortFor(hunt.deposit, locale).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>

        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer font-medium">{t("commit.fullTerms")}</summary>
          <div className="mt-2 max-h-40 overflow-auto whitespace-pre-line rounded border p-2">
            {termsFullFor(hunt.deposit, locale)}
          </div>
        </details>

        <Separator />

        {/* Acceptation toujours obligatoire */}
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <Checkbox
            checked={accepted}
            onCheckedChange={(checked) => setAccepted(checked === true)}
            disabled={isCommitted}
            className="mt-0.5"
          />
          <span>{t("commit.accept")}</span>
        </label>

        {needsPass && !isCommitted && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950 p-3 text-sm text-amber-800 dark:text-amber-300">
            {t("commit.needPass")}{" "}
            <Link to="/pass" className="font-medium underline">
              {t("commit.getPass")}
            </Link>
          </p>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          {!isConnected ? (
            <Button onClick={onConnectWallet} disabled={walletLoading}>
              {walletLoading ? t("wallet.connecting") : t("wallet.connect")}
            </Button>
          ) : (
            <Button
              onClick={handleConfirm}
              disabled={!accepted || !canCommit || !personalValid || needsPass}
            >
              {isSubmitting ? t("commit.submitting") : t("commit.confirm")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
