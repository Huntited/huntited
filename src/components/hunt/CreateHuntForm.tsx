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
import {
  MAX_CAUTION_KAS,
  MIN_CAUTION_KAS,
  SOMPI_PER_KAS,
  cautionTerms,
  sompiToKasFr,
} from "@/lib/hunt-economics";

/** Ce que devient la caution saisie, selon l'issue (recalculé à chaque saisie). */
function CautionBreakdown({ deposit }: { deposit: number }) {
  const valid =
    Number.isInteger(deposit) && deposit >= MIN_CAUTION_KAS && deposit <= MAX_CAUTION_KAS;
  const caution = BigInt(valid ? deposit : MIN_CAUTION_KAS) * SOMPI_PER_KAS;
  const c = cautionTerms(caution);
  const kas = (s: bigint) => `${sompiToKasFr(s)} KAS`;
  return (
    <ul className="space-y-0.5 text-xs text-muted-foreground">
      <li>
        <strong>Action réussie :</strong> jusqu'à {kas(c.capPerCommitSompi)} par engagé (
        {kas(c.successPoolSompi)} au plus), {kas(c.successTreasurySompi)} à Huntited, le reste t'est
        rendu.
      </li>
      <li>
        <strong>Action annulée :</strong> {kas(c.failureTreasurySompi)} à Huntited,{" "}
        {kas(caution - c.failureTreasurySompi)} te sont rendus.
      </li>
      <li>
        Minimum {MIN_CAUTION_KAS} KAS. Une caution plus élevée récompense davantage les engagés.
      </li>
    </ul>
  );
}

interface CreateHuntFormValues {
  title: string;
  description: string;
  location: string;
  deadline: string;
  threshold: string;
  deposit: string;
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
    deposit: String(CREATE_DEPOSIT_KAS),
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
    deposit: Number(values.deposit),
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
      deposit: String(draft.deposit),
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
          aria-invalid={errors.title ? true : undefined}
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
          aria-invalid={errors.description ? true : undefined}
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
          aria-invalid={errors.location ? true : undefined}
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
          aria-invalid={errors.deadline ? true : undefined}
          type="datetime-local"
          value={values.deadline}
          onChange={setField("deadline")}
        />
        <ErrorText msg={errors.deadline} />
        <p className="text-xs text-muted-foreground">
          Seuil pas atteint à cette date : action annulée.
        </p>
      </div>

      {/* Seuil de participants */}
      <div className="space-y-2">
        <Label htmlFor="threshold">Seuil de participants</Label>
        <Input
          id="threshold"
          aria-invalid={errors.threshold ? true : undefined}
          type="number"
          min={minHuntThreshold()}
          value={values.threshold}
          onChange={setField("threshold")}
          placeholder="Ex. 50"
        />
        <ErrorText msg={errors.threshold} />
        <p className="text-xs text-muted-foreground">
          Personnes nécessaires pour que l'action ait lieu. Minimum {minHuntThreshold()}.
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
          Personne ne voit le nombre d'engagés avant la fin. (Version de test : caché à l'écran
          seulement.)
        </p>
        <p className="text-xs font-medium text-green-700">
          Recommandé : sans compteur visible, personne n'attend de voir les autres pour se lancer,
          et s'engager le premier n'expose pas.
        </p>
      </div>

      {/* Caution du créateur : 30 KAS au moins, au choix ; jamais de gain. */}
      <div className="space-y-2">
        <Label htmlFor="deposit">Ta caution (KAS)</Label>
        <Input
          id="deposit"
          aria-invalid={errors.deposit ? true : undefined}
          type="number"
          min={MIN_CAUTION_KAS}
          step={1}
          value={values.deposit}
          onChange={setField("deposit")}
        />
        <ErrorText msg={errors.deposit} />
        <CautionBreakdown deposit={Number(values.deposit)} />
      </div>

      {/* Dépôt d'engagement — fixé par le protocole pour le MVP */}
      <div className="space-y-2">
        <Label htmlFor="commit-deposit">Dépôt d'engagement (par participant)</Label>
        <Input id="commit-deposit" value={`${COMMIT_DEPOSIT_KAS} KAS`} readOnly disabled />
        <p className="text-xs text-muted-foreground">
          Rendu au participant à la fin, que l'action réussisse ou non.
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
