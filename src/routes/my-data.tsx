import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  SECRET_GROUPS,
  downloadDeviceData,
  eraseDeviceData,
  prettyValue,
  readDeviceData,
  type DataGroup,
} from "@/lib/device-data";
import { useI18n, type MessageKey } from "@/lib/i18n";

export const Route = createFileRoute("/my-data")({
  head: () => ({
    meta: [
      { title: "Tes données — Huntited" },
      {
        name: "description",
        content: "Tout ce que Huntited garde sur ton appareil et sur son serveur.",
      },
    ],
  }),
  component: MyDataPage,
});

/** Ce que Huntited garde dans ce navigateur (et sur son serveur), avec export et effacement. */
function MyDataPage() {
  const { t, locale } = useI18n();
  // Lu dans le navigateur seulement (le serveur ne voit pas ce stockage).
  const [groups, setGroups] = useState<DataGroup[] | null>(null);
  const [erasing, setErasing] = useState(false);
  useEffect(() => setGroups(readDeviceData()), []);

  const size = (bytes: number) =>
    bytes < 1024
      ? t("data.bytes", { n: bytes })
      : t("data.kb", { n: (bytes / 1024).toLocaleString(locale, { maximumFractionDigits: 1 }) });

  async function erase() {
    setErasing(true);
    await eraseDeviceData();
    // Rechargement : l'application repart de zéro (wallet, pass, préférences).
    window.location.assign("/my-data");
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{t("data.title")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("data.lead")}</p>

      <section aria-labelledby="device-title" className="mt-8">
        <h2 id="device-title" className="font-semibold">
          {t("data.device")}
        </h2>
        {groups === null ? (
          <p className="mt-3 text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : groups.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{t("data.empty")}</p>
        ) : (
          <ul className="mt-3 divide-y border-y">
            {groups.map((g) => (
              <li key={g.id} className="py-3">
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="text-sm font-medium">{t(`data.group.${g.id}` as MessageKey)}</h3>
                  <span className="shrink-0 text-xs text-muted-foreground">{size(g.bytes)}</span>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {t(`data.group.${g.id}.text` as MessageKey)}
                </p>
                {SECRET_GROUPS.includes(g.id) ? (
                  <p className="mt-1 text-xs text-muted-foreground">{t("data.secret")}</p>
                ) : (
                  <details className="mt-1 text-xs">
                    <summary className="cursor-pointer text-muted-foreground underline-offset-2 hover:underline">
                      {t("data.show")}
                    </summary>
                    <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-muted p-3 text-[11px] leading-snug">
                      {g.entries.map((e) => `${e.key}\n${prettyValue(e.value)}`).join("\n\n")}
                    </pre>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}

        {groups !== null && groups.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" onClick={downloadDeviceData}>
              {t("data.export")}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-destructive">
                  {t("data.erase")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("data.erase.title")}</AlertDialogTitle>
                  <AlertDialogDescription>{t("data.erase.text")}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void erase()} disabled={erasing}>
                    {t("data.erase.confirm")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
        {groups?.some((g) => g.id === "pass") && (
          <p className="mt-2 text-xs text-muted-foreground">{t("data.export.note")}</p>
        )}
      </section>

      <section aria-labelledby="server-title" className="mt-10">
        <h2 id="server-title" className="font-semibold">
          {t("data.server")}
        </h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>{t("data.server.hunts")}</li>
          <li>{t("data.server.commits")}</li>
          <li>{t("data.server.never")}</li>
        </ul>
        <p className="mt-3 text-sm">
          <Link to="/legal" hash="privacy" className="underline underline-offset-2">
            {t("data.server.more")}
          </Link>
        </p>
      </section>
    </div>
  );
}
