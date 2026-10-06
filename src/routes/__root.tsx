import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { type ReactNode } from "react";

import appCss from "../styles.css?url";
import { AppFooter, AppHeader } from "@/components/AppHeader";
import { DevResetButton } from "@/components/DevResetButton";
import { LogoMark } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

/** Lien d'évitement (clavier, lecteur d'écran) : visible seulement au focus. */
function SkipLink() {
  const { t } = useI18n();
  return (
    <a
      href="#main"
      className="sr-only z-50 rounded-md bg-foreground px-3 py-2 text-sm text-background focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
    >
      {t("a11y.skip")}
    </a>
  );
}
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  const { t } = useI18n();
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">
      <LogoMark className="h-14 w-14" />
      <p className="mt-6 text-sm font-semibold text-muted-foreground">404</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{t("notFound.title")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("notFound.text")}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link to="/">{t("notFound.home")}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/create">{t("notFound.create")}</Link>
        </Button>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  // Erreur affichée dans la console de l'appareil uniquement : rien n'est
  // envoyé à un service extérieur.
  console.error(error);
  const router = useRouter();
  const { t } = useI18n();

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 text-center">
      <LogoMark className="h-14 w-14" />
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">{t("error.title")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("error.text")}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button
          onClick={() => {
            void router.invalidate();
            reset();
          }}
        >
          {t("error.retry")}
        </Button>
        <Button asChild variant="outline">
          <a href="/">{t("error.home")}</a>
        </Button>
      </div>
    </div>
  );
}
export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Huntited" },
      {
        name: "description",
        content: "Des actions collectives sans risque d'y aller seul : tout le monde ou personne.",
      },
      { property: "og:title", content: "Huntited" },
      {
        property: "og:description",
        content: "Des actions collectives sans risque d'y aller seul : tout le monde ou personne.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning : le thème (classe `dark`) et la langue sont
    // appliqués sur <html> avant l'hydratation.
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex min-h-screen flex-col">
        <SkipLink />
        <AppHeader />
        <main id="main" tabIndex={-1} className="flex-1 outline-none">
          {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
          <Outlet />
        </main>
        <AppFooter />
      </div>
      <DevResetButton />
      <Toaster />
    </QueryClientProvider>
  );
}
