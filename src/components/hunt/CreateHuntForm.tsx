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
import { CityInput } from "@/components/hunt/CityInput";
import { TemplatePicker } from "@/components/hunt/TemplatePicker";
import type { CitySuggestion } from "@/lib/cities";
import { isOnlineHunt, ONLINE_LOCATION } from "@/lib/online";
import {
  HUNT_TEMPLATES,
  suggestedDeadline,
  templateText,
  type HuntTemplate,
} from "@/lib/hunt-templates";
import { sortedCountries } from "@/lib/countries";
import { useI18n } from "@/lib/i18n";
import { minHuntThreshold, validateHuntForm, hasErrors, type FormErrors } from "@/lib/validation";
import { SettlementSimulator } from "@/components/hunt/SettlementSimulator";
import { MIN_CAUTION_KAS } from "@/lib/hunt-economics";

/** Pourquoi la caution n'est pas rendue en entier (les montants : simulation ci-dessous). */
function CautionBreakdown() {
  const { t } = useI18n();
  return (
    <ul className="space-y-0.5 text-xs text-muted-foreground">
      <li>{t("form.caution.why")}</li>
      <li>{t("form.caution.min", { min: MIN_CAUTION_KAS })}</li>
    </ul>
  );
}

interface CreateHuntFormValues {
  title: string;
  description: string;
  location: string;
  country: string;
  deadline: string;
  threshold: string;
  deposit: string;
  hideProgress: boolean;
  /** Action en ligne : ni ville ni pays. */
  online: boolean;
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
    country: "",
    deadline: "",
    threshold: "",
    deposit: String(CREATE_DEPOSIT_KAS),
    hideProgress: false,
    online: false,
  });
  // Noms des pays : calculés dans le navigateur seulement (ceux du serveur,
  // fournis par Node, peuvent différer légèrement → erreur d'hydratation).
  const [countryOptions, setCountryOptions] = useState<{ code: string; name: string }[]>([]);
  useEffect(() => setCountryOptions(sortedCountries(locale)), [locale]);
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
    location: values.online ? ONLINE_LOCATION : values.location,
    country: values.online ? "" : values.country,
    deadline: values.deadline,
    threshold: Number(values.threshold),
    deposit: Number(values.deposit),
    commitDeposit: COMMIT_DEPOSIT_KAS,
    progressVisibility: values.hideProgress ? "hidden" : "visible",
  });

  // Villes de la base qui correspondent exactement au lieu saisi (une par pays) ;
  // undefined : pas encore vérifié ; null : base indisponible (pas de blocage).
  const [cityMatches, setCityMatches] = useState<CitySuggestion[] | null | undefined>();
  const resolveCity = (matches: CitySuggestion[] | null) => {
    setCityMatches(matches);
    // Ville reconnue mais pas dans le pays choisi (ou pays vide) : on prend
    // le pays de la plus peuplée ; il reste modifiable.
    if (matches?.length) {
      setValues((prev) =>
        matches.some((m) => m.country === prev.country)
          ? prev
          : { ...prev, country: matches[0]!.country },
      );
    }
  };
  const cityInCountry = cityMatches?.find((m) => m.country === values.country);
  const cityError: string | undefined =
    values.online || !values.location.trim() || !cityMatches
      ? undefined
      : cityMatches.length === 0
        ? t("val.city.unknown")
        : !cityInCountry
          ? t("val.city.country")
          : undefined;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitted(true);

    // Validation centralisée (src/lib/validation.ts), plus la ville (base de villes).
    const errs = validateHuntForm(toFormData(), locale);
    if (hasErrors(errs) || cityError) return;

    setIsSubmitting(true);
    setGlobalError(null);
    try {
      // On garde le brouillon sur l'appareil puis on passe au récapitulatif,
      // avec le nom officiel de la ville (« marseille » → « Marseille »).
      setCreateHuntDraft({
        ...toFormData(),
        ...(cityInCountry && !values.online ? { location: cityInCountry.name } : {}),
      });
      navigate({ to: "/create-review" });
    } catch {
      setGlobalError(t("form.draftError"));
      setIsSubmitting(false);
    }
  };

  // Retour depuis le récapitulatif : on préremplit avec le brouillon.
  // Le pays n'est jamais deviné : il vient de la ville choisie, ou de la liste.
  useEffect(() => {
    const draft = getCreateHuntDraft();
    if (!draft) return;
    const online = isOnlineHunt(draft);
    setValues({
      title: draft.title,
      description: draft.description,
      location: online ? "" : draft.location,
      country: draft.country ?? "",
      deadline: draft.deadline,
      threshold: String(draft.threshold),
      deposit: String(draft.deposit),
      hideProgress: draft.progressVisibility === "hidden",
      online,
    });
  }, []);

  // Modèle appliqué (et valeurs d'avant, pour pouvoir annuler).
  const [applied, setApplied] = useState<{
    template: HuntTemplate;
    previous: CreateHuntFormValues;
  } | null>(null);

  const applyTemplate = (template: HuntTemplate) => {
    const text = templateText(template.id, locale);
    setApplied({ template, previous: applied?.previous ?? values });
    setValues((prev) => ({
      ...prev,
      title: text.title,
      description: text.description,
      deadline: suggestedDeadline(template.days),
      threshold: String(Math.max(template.threshold, minHuntThreshold())),
      hideProgress: template.hideProgress,
      online: template.online ?? false,
    }));
  };

  const undoTemplate = () => {
    if (applied) setValues(applied.previous);
    setApplied(null);
  };

  // Les erreurs ne s'affichent qu'après une première tentative d'envoi
  const errors: FormErrors = submitted ? validateHuntForm(toFormData(), locale) : {};

  // Bouton désactivé tant que tous les champs ne sont pas remplis.
  const isSubmitDisabled =
    isSubmitting ||
    !values.title.trim() ||
    !values.description.trim() ||
    (!values.online && !values.location.trim()) ||
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

  // Seuil conseillé par l'exemple choisi (expliqué tant qu'il n'est pas modifié).
  const suggested = applied ? Math.max(applied.template.threshold, minHuntThreshold()) : null;
  const thresholdHint =
    applied && String(suggested) === values.threshold
      ? t("tpl.why", { why: templateText(applied.template.id, locale).why })
      : null;

  return (
    <div className="space-y-6">
      <TemplatePicker
        selected={applied?.template.id ?? null}
        onPick={(id) => applyTemplate(HUNT_TEMPLATES.find((tpl) => tpl.id === id)!)}
        onUndo={undoTemplate}
      />
      {/* noValidate : nos messages (traduits, avec la raison) plutôt que ceux du navigateur. */}
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

          {/* Où : sur place (ville vérifiée + pays) ou en ligne */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t("form.where")}</legend>
            <div role="radiogroup" className="flex flex-wrap gap-1.5">
              {([false, true] as const).map((online) => (
                <button
                  key={String(online)}
                  type="button"
                  role="radio"
                  aria-checked={values.online === online}
                  onClick={() => setValues((prev) => ({ ...prev, online }))}
                  className="rounded-full border px-3 py-1 text-sm transition-colors hover:border-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-checked:border-foreground aria-checked:bg-foreground aria-checked:text-background"
                >
                  {t(online ? "form.where.online" : "form.where.place")}
                </button>
              ))}
            </div>
            {values.online && (
              <p className="text-xs text-muted-foreground">{t("form.where.onlineHelp")}</p>
            )}
          </fieldset>

          {/* Ville : vérifiée dans la base de villes (sur l'appareil) */}
          {!values.online && (
            <div className="space-y-2">
              <Label htmlFor="location">{t("form.city")}</Label>
              <CityInput
                id="location"
                invalid={!!errors.location || (submitted && !!cityError)}
                describedBy={
                  describe("location") ?? (submitted && cityError ? "city-error" : undefined)
                }
                value={values.location}
                onChange={(text) => setValues((prev) => ({ ...prev, location: text }))}
                // Ville choisie : elle remplit le lieu et le pays.
                onPick={(city) =>
                  setValues((prev) => ({ ...prev, location: city.name, country: city.country }))
                }
                onResolve={resolveCity}
                placeholder={t("form.location.placeholder")}
              />
              <ErrorText id="location" msg={errors.location} />
              {!errors.location && submitted && <ErrorText id="city" msg={cityError} />}
              <p className="text-xs text-muted-foreground">{t("form.location.help")}</p>
            </div>
          )}

          {/* Pays : liste native (recherche au clavier, confortable sur mobile) */}
          {!values.online && (
            <div className="space-y-2">
              <Label htmlFor="country">{t("form.country")}</Label>
              <select
                id="country"
                value={values.country}
                onChange={(e) => setValues((prev) => ({ ...prev, country: e.target.value }))}
                aria-invalid={errors.country ? true : undefined}
                aria-describedby={describe("country")}
                data-filled={values.country ? "true" : "false"}
                className="hf-field flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-base shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:text-sm"
              >
                <option value="">{t("form.country.placeholder")}</option>
                {countryOptions.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
              <ErrorText id="country" msg={errors.country} />
            </div>
          )}

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
              {thresholdHint ?? t("form.threshold.help", { min: minHuntThreshold() })}
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
            <CautionBreakdown />
          </div>
          <div>
            <SettlementSimulator
              role="creator"
              cautionKas={Number(values.deposit)}
              threshold={Number(values.threshold)}
              onThresholdChange={(v) => setValues((prev) => ({ ...prev, threshold: String(v) }))}
            />
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
    </div>
  );
}
