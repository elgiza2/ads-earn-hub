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
import { useEffect, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { AppProvider, useApp } from "@/lib/app-context";
import { BottomNav } from "@/components/ads/BottomNav";
import { BoomerangVideoBg } from "@/components/ads/BoomerangVideoBg";
import { Header, Logo } from "@/components/ads/Shell";
import { MONETAG_ZONE } from "@/lib/ads.config";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      
      <div className="glass max-w-md rounded-2xl p-8 text-center">
        <h1 className="text-6xl font-normal">404</h1>
        <div className="mt-6">
          <Link to="/" className="pill-btn">ADS</Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      
      <div className="glass max-w-md rounded-2xl p-8 text-center">
        <h1 className="text-xl font-normal">Something went wrong</h1>
        <button onClick={() => { router.invalidate(); reset(); }} className="pill-btn mt-6">Try again</button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" },
      { title: "ADS — Watch ads, earn crypto" },
      { name: "description", content: "Watch ads and earn USDT, GRAM and ADS inside Telegram." },
      { property: "og:title", content: "ADS — Watch ads, earn crypto" },
      { property: "og:description", content: "Watch ads and earn USDT, GRAM and ADS inside Telegram." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "stylesheet", href: "https://db.onlinewebfonts.com/c/a64ff11d2c24584c767f6257e880dc65?family=Helvetica+Regular" }, { rel: "stylesheet", href: appCss }, { rel: "icon", href: "/favicon.ico", type: "image/x-icon" }],
    scripts: [
      { src: "https://telegram.org/js/telegram-web-app.js" },
      { src: "https://libtl.com/sdk.js", "data-zone": MONETAG_ZONE, "data-sdk": `show_${MONETAG_ZONE}` } as any,
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function Gate({ children }: { children: ReactNode }) {
  const { ready, inTelegram, state, t, loadError } = useApp();
  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="relative z-10 h-10 w-10 animate-spin rounded-full border-2 border-glass-border border-t-foreground" />
      </div>
    );
  }
  if (!inTelegram || !state) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-6">
        <div className="glass max-w-sm rounded-2xl p-8 text-center">
          <div className="text-5xl font-normal tracking-tighter">ADS</div>
          {loadError ? (
            <>
              <h1 className="mt-4 text-xl font-normal">Something went wrong</h1>
              <p className="mt-2 break-words text-sm text-muted-foreground">{loadError}</p>
            </>
          ) : (
            <>
              <h1 className="mt-4 text-xl font-normal">{t("open_in_tg")}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{t("open_in_tg_sub")}</p>
            </>
          )}
        </div>
      </div>
    );
  }
  return (
    <>
      <Header />
      {children}
      <BottomNav />
    </>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <BoomerangVideoBg />
        <Gate>
          <Outlet />
        </Gate>
        <Toaster position="top-center" />
      </AppProvider>
    </QueryClientProvider>
  );
}
