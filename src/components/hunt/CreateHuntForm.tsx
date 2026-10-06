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
import { useI18n } from "@/lib/i18n";
import { minHuntThreshold, validateHuntForm, hasErrors, type FormErrors } from "@/lib/validation";
import {
  MAX_CAUTION_KAS,
  MIN_CAUTION_KAS,
  SOMPI_PER_KAS,
  cautionTerms,
  sompiToKasFr,
  sompiToKasText,
} from "@/lib/hunt-economics";

/** Ce que devient la caution saisie, selon l'issue (recalculé à chaque saisie). */
function CautionBreakdown({ deposit }: { deposit: number }) {
  const { t, locale } = useI18n();
  const valid =
    Number.isInteger(deposit) && deposit >= MIN_CAUTION_KAS && deposit <= MAX_CAUTION_KAS;
  const caution = BigInt(valid ? deposit : MIN_CAUTION_KAS) * SOMPI_PER_KAS;
  const c = cautionTerms(caution);
  const kas = (s: bigint) =>
    `${locale === "fr" ? sompiToKasFr(s) : sompiToKasText(((s + 500_000n) / 1_000_000n) * 1_000_000n)} KAS`;
  return (
    <ul className="space-y-0.5 text-xs text-muted-foreground">
      <li>
        <strong>{t("form.caution.success")}</strong>{" "}
        {t("form.caution.successText", {
          cap: kas(c.capPerCommitSompi),
          pool: kas(c.successPoolSompi),
          fee: kas(c.successTreasurySompi),
        })}
      </li>
      <li>
        <strong>{t("form.caution.failure")}</strong>{" "}
        {t("form.caution.failureText", {
          fee: kas(c.failureTreasurySompi),
          refund: kas(caution - c.failureTreasurySompi),
        })}
      </li>
      <li>{t("form.caution.min", { min: MIN_CAUTION_KAS })}</li>
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
 * Le brouillon est gardé sur l'appareil ; la création réelle se fait sur
 * le récapitulatif (/create-review).
 */
export function CreateHuntForm() {
  const navigate = useNavigate();
  const { t, locale } = useI18n();
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
  // Erreur globale, distincte des erreurs de validation champ par champ.
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
    const errs = validateHuntForm(toFormData(), locale);
    if (hasErrors(errs)) return;

    setIsSubmitting(true);
    setGlobalError(null);
    try {
      // On garde le brouillon sur l'appareil puis on passe au récapitulatif.
      setCreateHuntDraft(toFormData());
      navigate({ to: "/create-review" });
    } catch {
      setGlobalError(t("form.draftError"));
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
  const errors: FormErrors = submitted ? validateHuntForm(toFormData(), locale) : {};

  // Bouton désactivé tant que tous les champs ne sont pas remplis.
  const isSubmitDisabled =
    isSubmitting ||
    !values.title.trim() ||
    !values.description.trim() ||
    !values.location.trim() ||
    !values.deadline ||
    !Number(values.threshold);

  // Message relié à son champ (aria-describedby) et annoncé par les lecteurs d'écran.
  const ErrorText = ({ id, msg }: { id: string; msg?: string | undefined }) =>
    msg ? (
      <p id={`${id}-error`} className="text-xs text-destructive" aria-live="polite">
        {msg}
      </p>
    ) : null;
  const describe = (id: keyof FormErrors) => (errors[id] ? `${id}-error` : undefined);

  return (
    // noValidate : nos messages (traduits, avec la raison) plutôt que ceux du navigateur.
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <fieldset className="space-y-5 rounded-lg border bg-card p-4 sm:p-5 [&>legend+*]:clear-both">
        <legend className="float-left w-full border-b pb-2 text-base font-semibold">
          {t("form.section.action")}
        </legend>
        <div className="space-y-2">
          <Label htmlFor="title">{t("form.title")}</Label>
          <Input
            id="title"
            aria-invalid={errors.title ? true : undefined}
            aria-describedby={describe("title")}
            value={values.title}
            onChange={setField("title")}
            placeholder={t("form.title.placeholder")}
          />
          <ErrorText id="title" msg={errors.title} />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description">{t("form.description")}</Label>
          <Textarea
            id="description"
            aria-invalid={errors.description ? true : undefined}
            aria-describedby={describe("description")}
            value={values.description}
            onChange={setField("description")}
            placeholder={t("form.description.placeholder")}
            rows={4}
          />
          <ErrorText id="description" msg={errors.description} />
        </div>

        {/* Lieu — texte libre, aucune donnée de géoloc */}
        <div className="space-y-2">
          <Label htmlFor="location">{t("hunt.location")}</Label>
          <Input
            id="location"
            aria-invalid={errors.location ? true : undefined}
            aria-describedby={describe("location")}
            value={values.location}
            onChange={setField("location")}
            placeholder={t("form.location.placeholder")}
          />
          <ErrorText id="location" msg={errors.location} />
          <p className="text-xs text-muted-foreground">{t("form.location.help")}</p>
        </div>

        {/* Date/heure limite */}
        <div className="space-y-2">
          <Label htmlFor="deadline">{t("form.deadline")}</Label>
          <Input
            id="deadline"
            aria-invalid={errors.deadline ? true : undefined}
            aria-describedby={describe("deadline")}
            type="datetime-local"
            value={values.deadline}
            onChange={setField("deadline")}
          />
          <ErrorText id="deadline" msg={errors.deadline} />
          <p className="text-xs text-muted-foreground">{t("form.deadline.help")}</p>
        </div>
      </fieldset>

      <fieldset className="space-y-5 rounded-lg border bg-card p-4 sm:p-5 [&>legend+*]:clear-both">
        <legend className="float-left w-full border-b pb-2 text-base font-semibold">
          {t("form.section.people")}
        </legend>
        <div className="space-y-2">
          <Label htmlFor="threshold">{t("form.threshold")}</Label>
          <Input
            id="threshold"
            aria-invalid={errors.threshold ? true : undefined}
            aria-describedby={describe("threshold")}
            type="number"
            min={minHuntThreshold()}
            value={values.threshold}
            onChange={setField("threshold")}
            placeholder={t("form.threshold.placeholder")}
          />
          <ErrorText id="threshold" msg={errors.threshold} />
          <p className="text-xs text-muted-foreground">
            {t("form.threshold.help", { min: minHuntThreshold() })}
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
            <span>{t("form.hide")}</span>
          </label>
          <p className="text-xs text-muted-foreground">{t("form.hide.help")}</p>
          <p className="text-xs font-medium text-green-700 dark:text-green-400">
            {t("form.hide.recommended")}
          </p>
        </div>
      </fieldset>

      <fieldset className="space-y-5 rounded-lg border bg-card p-4 sm:p-5 [&>legend+*]:clear-both">
        <legend className="float-left w-full border-b pb-2 text-base font-semibold">
          {t("form.section.money")}
        </legend>
        <div className="space-y-2">
          <Label htmlFor="deposit">{t("form.caution.label")}</Label>
          <Input
            id="deposit"
            aria-invalid={errors.deposit ? true : undefined}
            aria-describedby={describe("deposit")}
            type="number"
            min={MIN_CAUTION_KAS}
            step={1}
            value={values.deposit}
            onChange={setField("deposit")}
          />
          <ErrorText id="deposit" msg={errors.deposit} />
          <CautionBreakdown deposit={Number(values.deposit)} />
        </div>

        {/* Dépôt d'engagement — fixé par le protocole pour le MVP */}
        <div className="space-y-2">
          <Label htmlFor="commit-deposit">{t("form.commitDeposit")}</Label>
          <Input id="commit-deposit" value={`${COMMIT_DEPOSIT_KAS} KAS`} readOnly disabled />
          <p className="text-xs text-muted-foreground">{t("form.commitDeposit.help")}</p>
        </div>
      </fieldset>

      {/* Erreur globale (distincte des erreurs de validation) */}
      {globalError && (
        <p className="text-sm text-destructive" role="alert">
          {globalError}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={isSubmitDisabled}>
        {isSubmitting ? t("common.loading") : t("form.submit")}
      </Button>
    </form>
  );
}
