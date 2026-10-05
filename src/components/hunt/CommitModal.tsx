import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { COMMIT_DEPOSIT_TERMS, termsShort, termsFull } from "@/lib/terms";
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
  const [accepted, setAccepted] = useState(false);
  const { isConnected, isCommitted, canCommit, isSubmitting, error, commit } = commitment;

  const handleConfirm = async () => {
    try {
      await commit();
      setAccepted(false);
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
          <DialogTitle>Engagement de {hunt.commitDeposit} KAS</DialogTitle>
          <DialogDescription>{hunt.title}</DialogDescription>
        </DialogHeader>

        {isCommitted ? (
          <p role="status" className="rounded-lg border bg-muted/40 p-4 text-sm">
            Tu es déjà engagé·e dans cette hunt.
          </p>
        ) : (
          <div className="space-y-2 rounded-lg border bg-muted/40 p-4 text-sm">
            <p>
              <strong>Dépôt :</strong> {hunt.commitDeposit} KAS, verrouillés dans le covenant
              (simulé).
            </p>
            <p>{COMMIT_DEPOSIT_TERMS}</p>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Date limite</span>
              <span className="font-medium">
                {new Date(hunt.deadline).toLocaleString("fr-FR", {
                  dateStyle: "long",
                  timeStyle: "short",
                })}
              </span>
            </div>
            {walletAddress && (
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Wallet</span>
                <code className="text-xs">{shortAddress(walletAddress)}</code>
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Conditions clés</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {termsShort.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>

        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer font-medium">Voir les conditions complètes</summary>
          <div className="mt-2 max-h-40 overflow-auto whitespace-pre-line rounded border p-2">
            {termsFull}
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
          <span>
            J'ai compris que mon dépôt reste verrouillé jusqu'au succès ou à l'expiration de la
            chasse.
          </span>
        </label>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          {!isConnected ? (
            <Button onClick={onConnectWallet} disabled={walletLoading}>
              {walletLoading ? "Connexion…" : "Connecter le wallet"}
            </Button>
          ) : (
            <Button onClick={handleConfirm} disabled={!accepted || !canCommit}>
              {isSubmitting ? "Engagement…" : "Confirmer l'engagement"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
