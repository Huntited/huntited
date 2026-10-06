import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { HuntFormData } from "@/lib/types";
import { COMMIT_DEPOSIT_KAS, CREATE_DEPOSIT_KAS } from "@/lib/covenants";
import { getCreateHuntDraft, setCreateHuntDraft } from "@/lib/create-hunt-store";
import { minHuntThreshold, validateHuntForm, hasErrors, type FormErrors } from "@/lib/validation";

interface CreateHuntFormValues {
  title: string;
  description: string;
  location: string;
  deadline: string;
  threshold: string;
  hideProgress: boolean;
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
    hideProgress: false,
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
    progressVisibility: values.hideProgress ? "hidden" : "visible",
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
      hideProgress: draft.progressVisibility === "hidden",
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
    // noValidate : nos messages (en français, avec la raison) plutôt que ceux du navigateur.
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
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
          Si le seuil n'est pas atteint à cette date, la chasse est annulée et chacun est remboursé.
        </p>
      </div>

      {/* Seuil de participants */}
      <div className="space-y-2">
        <Label htmlFor="threshold">Seuil de participants</Label>
        <Input
          id="threshold"
          type="number"
          min={minHuntThreshold()}
          value={values.threshold}
          onChange={setField("threshold")}
          placeholder="Ex. 50"
        />
        <ErrorText msg={errors.threshold} />
        <p className="text-xs text-muted-foreground">
          Nombre minimum de personnes pour que l'action ait lieu ({minHuntThreshold()} au moins : en
          dessous, tu perdrais de l'argent même si l'action réussit).
        </p>
      </div>

      {/* Visibilité de la progression */}
      <div className="space-y-2">
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <Checkbox
            id="hide-progress"
            checked={values.hideProgress}
            onCheckedChange={(checked) =>
              setValues((prev) => ({ ...prev, hideProgress: checked === true }))
            }
            className="mt-0.5"
          />
          <span>Masquer la progression</span>
        </label>
        <p className="text-xs text-muted-foreground">
          Le nombre d'engagés reste caché jusqu'au déclenchement ou à la date limite : personne
          n'hésite à s'engager le premier. (Version de test : c'est seulement caché à l'écran.)
        </p>
      </div>

      {/* Dépôt de création — fixé, non modifiable pour l'instant */}
      <div className="space-y-2">
        <Label htmlFor="deposit">Ta caution</Label>
        <Input id="deposit" value={`${CREATE_DEPOSIT_KAS} KAS`} readOnly disabled />
        <p className="text-xs text-muted-foreground">
          Tu bloques {CREATE_DEPOSIT_KAS} KAS en créant la chasse, et ils sont partagés avec les
          engagés. Si l'action a lieu, 95 % (28,5 KAS) vont aux engagés et 5 % à Huntited. Sinon,
          47,5 % (14,25 KAS) vont aux engagés, 2,5 % à Huntited, et tu récupères la moitié (15 KAS).
        </p>
      </div>

      {/* Dépôt d'engagement — fixé par le protocole pour le MVP */}
      <div className="space-y-2">
        <Label htmlFor="commit-deposit">Prix de l'engagement</Label>
        <Input id="commit-deposit" value={`${COMMIT_DEPOSIT_KAS} KAS`} readOnly disabled />
        <p className="text-xs text-muted-foreground">
          Chaque participant bloque {COMMIT_DEPOSIT_KAS} KAS. Si l'action a lieu, tu reçois 95 % de
          ces KAS (5 % vont à Huntited). Sinon, chacun récupère les siens.
        </p>
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
