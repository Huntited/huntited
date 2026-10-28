// Étapes de création d'une action : 1. Quoi et où · 2. Quand et combien ·
// 3. Vérifier et publier (cette dernière sur la page de récapitulatif).
import { Check } from "lucide-react";

import { useI18n } from "@/lib/i18n";

const STEPS = ["create.step.1", "create.step.2", "create.step.3"] as const;

export function CreateSteps({ current }: { current: 1 | 2 | 3 }) {
  const { t } = useI18n();
  return (
    <ol className="flex items-center gap-2 text-xs" aria-label={t("create.steps")}>
      {STEPS.map((key, i) => {
        const n = i + 1;
        const done = n < current;
        const here = n === current;
        return (
          <li
            key={key}
            aria-current={here ? "step" : undefined}
            className={`flex min-w-0 items-center gap-1.5 ${here ? "flex-1" : "sm:flex-1"}`}
          >
            <span
              className={`flex size-6 shrink-0 items-center justify-center rounded-full font-medium ${
                here || done
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {done ? <Check className="size-3.5" aria-hidden /> : n}
            </span>
            <span
              className={`truncate ${here ? "font-medium text-foreground" : "hidden text-muted-foreground sm:inline"}`}
            >
              {t(key)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
