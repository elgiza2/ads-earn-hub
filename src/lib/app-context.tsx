import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { bootstrap, getTranslations, refresh } from "./ads.functions";
import { BASE, RTL, t as tr, type Dict } from "./i18n";

declare global {
  interface Window {
    Telegram?: any;
    [k: `show_${string}`]: any;
  }
}

export type AppState = Awaited<ReturnType<typeof refresh>>;

type Ctx = {
  ready: boolean;
  inTelegram: boolean;
  initData: string;
  state: AppState | null;
  setState: (s: AppState) => void;
  reload: () => Promise<void>;
  t: (k: keyof Dict, n?: string | number) => string;
  rtl: boolean;
  botUsername: string;
};

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [inTelegram, setInTelegram] = useState(true);
  const [initData, setInitData] = useState("");
  const [state, setState] = useState<AppState | null>(null);
  const [dict, setDict] = useState<Dict>(BASE);
  const [rtl, setRtl] = useState(false);
  const [botUsername, setBot] = useState("");

  useEffect(() => {
    let tries = 0;
    const start = () => {
      const wa = window.Telegram?.WebApp;
      if (!wa && tries++ < 20) return void setTimeout(start, 100);
      if (!wa || !wa.initData) { setInTelegram(false); setReady(true); return; }
      wa.ready(); wa.expand();
      try { wa.setHeaderColor?.("#141827"); wa.setBackgroundColor?.("#141827"); } catch {}
      const lang = ((wa.initDataUnsafe?.user?.language_code || navigator.language || "en").split("-")[0] || "en").toLowerCase();
      setRtl(RTL.has(lang));
      document.documentElement.lang = lang;
      document.documentElement.dir = RTL.has(lang) ? "rtl" : "ltr";
      setInitData(wa.initData);
      getTranslations({ data: { lang } }).then((d) => setDict(d as Dict)).catch(() => {});
      bootstrap({ data: { initData: wa.initData } })
        .then((r) => { setBot(r.bot); setState(r); })
        .catch(() => setInTelegram(false))
        .finally(() => setReady(true));
    };
    start();
  }, []);

  const reload = useCallback(async () => {
    if (!initData) return;
    setState(await refresh({ data: { initData } }));
  }, [initData]);

  const t = useCallback((k: keyof Dict, n?: string | number) => tr(dict, k, n), [dict]);

  return (
    <AppCtx.Provider value={{ ready, inTelegram, initData, state, setState, reload, t, rtl, botUsername }}>
      {children}
    </AppCtx.Provider>
  );
}

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside provider");
  return c;
}

export function haptic(kind: "light" | "success" | "error" = "light") {
  const h = window.Telegram?.WebApp?.HapticFeedback;
  if (!h) return;
  if (kind === "light") h.impactOccurred("light");
  else h.notificationOccurred(kind);
}

export function errMsg(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}
