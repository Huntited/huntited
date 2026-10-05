import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { HuntFormData } from "@/lib/types";
import { COMMIT_DEPOSIT_KAS, CREATE_DEPOSIT_KAS } from "@/lib/covenants";
import { COMMIT_DEPOSIT_TERMS, CREATE_DEPOSIT_TERMS } from "@/lib/terms";
import { getCreateHuntDraft, setCreateHuntDraft } from "@/lib/create-hunt-store";
import { validateHuntForm, hasErrors, type FormErrors } from "@/lib/validation";

interface CreateHuntFormValues {
  title: string;
  description: string;
  location: string;
  deadline: string;
  threshold: string;
}

/**
 * Formulaire de création d'une chasse.
 * Le MVP ne fait que simuler la création (délai + log) puis redirige
 * vers une chasse de démonstration : la connexion au contrat Kaspa
 * viendra ensuite.
 */
export function CreateHuntForm() {
  const navigate = useNavigate();
  const [values, setValues] = useState<CreateHuntFormValues>({
    title: "",
    description: "",
    location: "",
    deadline: "",
    threshold: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Erreur globale (échec de la création côté covenant), distincte des
  // erreurs de validation champ par champ.
  const [globalError, setGlobalError] = useState<string | null>(null);

  const setField =
    (field: keyof CreateHuntFormValues) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setValues((prev) => ({ ...prev, [field]: event.target.value }));
    };

  const toFormData = (): HuntFormData => ({
    title: values.title,
    description: values.description,
    location: values.location,
    deadline: values.deadline,
    threshold: Number(values.threshold),
    deposit: CREATE_DEPOSIT_KAS,
    commitDeposit: COMMIT_DEPOSIT_KAS,
  });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitted(true);

    // Validation centralisée (src/lib/validation.ts)
    const errs = validateHuntForm(toFormData());
    if (hasErrors(errs)) return;

    setIsSubmitting(true);
    setGlobalError(null);
    try {
      // On garde le brouillon sur l'appareil puis on passe au récapitulatif.
      // La création réelle se fait sur /create-review.
      setCreateHuntDraft(toFormData());
      navigate({ to: "/create-review" });
    } catch {
      setGlobalError("Impossible d'enregistrer le brouillon. Réessaie.");
      setIsSubmitting(false);
    }
  };

  // Retour depuis le récapitulatif : on préremplit avec le brouillon.
  useEffect(() => {
    const draft = getCreateHuntDraft();
    if (!draft) return;
    setValues({
      title: draft.title,
      description: draft.description,
      location: draft.location,
      deadline: draft.deadline,
      threshold: String(draft.threshold),
    });
  }, []);

  // Les erreurs ne s'affichent qu'après une première tentative d'envoi
  const errors: FormErrors = submitted ? validateHuntForm(toFormData()) : {};

  // Bouton désactivé tant que tous les champs ne sont pas remplis
  // (ou pendant la simulation de création).
  const isSubmitDisabled =
    isSubmitting ||
    !values.title.trim() ||
    !values.description.trim() ||
    !values.location.trim() ||
    !values.deadline ||
    !Number(values.threshold);

  const ErrorText = ({ msg }: { msg?: string | undefined }) =>
    msg ? <p className="text-xs text-destructive">{msg}</p> : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Titre */}
      <div className="space-y-2">
        <Label htmlFor="title">Titre</Label>
        <Input
          id="title"
          value={values.title}
          onChange={setField("title")}
          placeholder="Ex. Rassemblement place de la République"
        />
        <ErrorText msg={errors.title} />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={values.description}
          onChange={setField("description")}
          placeholder="Décrivez l'action collective en quelques lignes."
          rows={4}
        />
        <ErrorText msg={errors.description} />
      </div>

      {/* Lieu — texte libre, aucune donnée de géoloc */}
      <div className="space-y-2">
        <Label htmlFor="location">Lieu</Label>
        <Input
          id="location"
          value={values.location}
          onChange={setField("location")}
          placeholder="Ex. Paris, place de la République"
        />
        <ErrorText msg={errors.location} />
        <p className="text-xs text-muted-foreground">
          Texte libre. Aucune position n'est collectée.
        </p>
      </div>

      {/* Date/heure limite */}
      <div className="space-y-2">
        <Label htmlFor="deadline">Date et heure limite</Label>
        <Input
          id="deadline"
          type="datetime-local"
          value={values.deadline}
          onChange={setField("deadline")}
        />
        <ErrorText msg={errors.deadline} />
        <p className="text-xs text-muted-foreground">
          Après cette date, la chasse est annulée si le seuil n'est pas atteint.
        </p>
      </div>

      {/* Seuil de participants */}
      <div className="space-y-2">
        <Label htmlFor="threshold">Seuil de participants</Label>
        <Input
          id="threshold"
          type="number"
          min={1}
          value={values.threshold}
          onChange={setField("threshold")}
          placeholder="Ex. 50"
        />
        <ErrorText msg={errors.threshold} />
        <p className="text-xs text-muted-foreground">
          Nombre minimum d'engagements pour déclencher l'action.
        </p>
      </div>

      {/* Dépôt de création — fixé, non modifiable pour l'instant */}
      <div className="space-y-2">
        <Label htmlFor="deposit">Dépôt de création</Label>
        <Input id="deposit" value={`${CREATE_DEPOSIT_KAS} KAS`} readOnly disabled />
        <p className="text-xs text-muted-foreground">
          Montant fixe pour le MVP, verrouillé dans le covenant de la chasse. {CREATE_DEPOSIT_TERMS}
        </p>
      </div>

      {/* Dépôt d'engagement — fixé par le protocole pour le MVP */}
      <div className="space-y-2">
        <Label htmlFor="commit-deposit">Dépôt par engagement</Label>
        <Input id="commit-deposit" value={`${COMMIT_DEPOSIT_KAS} KAS`} readOnly disabled />
        <p className="text-xs text-muted-foreground">{COMMIT_DEPOSIT_TERMS}</p>
      </div>

      {/* Erreur globale de création (distincte des erreurs de validation) */}
      {globalError && (
        <p className="text-sm text-destructive" role="alert">
          {globalError}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={isSubmitDisabled}>
        {isSubmitting ? "Chargement…" : "Vérifier ma chasse"}
      </Button>
    </form>
  );
}
