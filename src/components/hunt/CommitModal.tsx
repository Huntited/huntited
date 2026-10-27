import { Link } from "@tanstack/react-router";
import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AfterPicker } from "@/components/hunt/CommitExtras";
import { SettlementSimulator } from "@/components/hunt/SettlementSimulator";
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
import { getDataMode } from "@/lib/hunt-repository";
import { useI18n } from "@/lib/i18n";
import { termsFullFor, termsShortFor } from "@/lib/terms";
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
  const { t, locale } = useI18n();
  const [accepted, setAccepted] = useState(false);
  // Seuil personnel : « je viens si au moins N personnes viennent » (N ≥ seuil de la chasse).
  const [personal, setPersonal] = useState(String(hunt.threshold));
  // Chasses enchaînées (mode chaîne) : « seulement si cette autre chasse se déclenche ».
  const [after, setAfter] = useState<string | null>(null);
  const { isConnected, isCommitted, canCommit, isSubmitting, error, commit } = commitment;
  const personalValue = Number(personal);
  const personalValid =
    Number.isInteger(personalValue) && personalValue >= hunt.threshold && personalValue <= 100_000;

  const handleConfirm = async () => {
    try {
      await commit(
        personalValue !== hunt.threshold ? personalValue : undefined,
        after ?? undefined,
      );
      setAccepted(false);
      setPersonal(String(hunt.threshold));
      setAfter(null);
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
      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">{t("commit.title")}</DialogTitle>
          <DialogDescription>{hunt.title}</DialogDescription>
        </DialogHeader>

        {isCommitted ? (
          <p role="status" className="rounded-xl border bg-muted/40 p-4 text-sm">
            {t("commit.already")}
          </p>
        ) : (
          <>
            {/* L'essentiel, en trois lignes */}
            <ul className="space-y-3">
              {[
                t("commit.point.deposit", { amount: hunt.commitDeposit }),
                t("commit.point.secret"),
                t("commit.point.threshold", { threshold: hunt.threshold }),
              ].map((line) => (
                <li key={line} className="flex items-start gap-3">
                  <Check className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              {getDataMode() === "chain" ? t("commit.point.fee") : t("commit.testNote")}
            </p>

            {/* Options : seuil personnel, action enchaînée, simulation */}
            <details className="group rounded-xl border p-3 text-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between rounded-md font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {t("commit.options")}
                <ChevronDown
                  className="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none"
                  aria-hidden
                />
              </summary>
              <div className="mt-3 space-y-3">
                <div className="space-y-2">
                  <label htmlFor="personal-threshold" className="flex flex-wrap items-center gap-2">
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
                {getDataMode() === "chain" && (
                  <AfterPicker huntId={hunt.id} value={after} onChange={setAfter} />
                )}
                <SettlementSimulator
                  role="participant"
                  cautionKas={hunt.deposit}
                  threshold={hunt.threshold}
                  {...(personalValid && personalValue > hunt.threshold
                    ? { personalThreshold: personalValue }
                    : {})}
                />
                {walletAddress && (
                  <p className="text-xs text-muted-foreground">
                    Wallet <code>{shortAddress(walletAddress)}</code>
                  </p>
                )}
              </div>
            </details>
          </>
        )}

        {/* Conditions : résumé, texte complet replié */}
        <details className="group rounded-xl border p-3 text-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-md font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {t("commit.keyTerms")}
            <ChevronDown
              className="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none"
              aria-hidden
            />
          </summary>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-muted-foreground">
            {termsShortFor(hunt.deposit, locale).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <div className="mt-3 max-h-40 overflow-auto whitespace-pre-line rounded border p-2 text-xs text-muted-foreground">
            {termsFullFor(hunt.deposit, locale)}
          </div>
          <Link
            to="/legal"
            hash="conditions"
            target="_blank"
            className="mt-2 inline-block text-xs font-medium underline"
          >
            {t("commit.legalLink")}
          </Link>
        </details>

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

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          {!isConnected ? (
            <Button onClick={onConnectWallet} disabled={walletLoading}>
              {walletLoading ? t("wallet.connecting") : t("wallet.connect")}
            </Button>
          ) : (
            <Button
              className="h-11 rounded-xl text-base"
              onClick={handleConfirm}
              disabled={!accepted || !canCommit || !personalValid}
            >
              {isSubmitting ? t("commit.submitting") : t("commit.confirm")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
