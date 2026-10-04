import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { APP_URL, BOT_USERNAME } from "./ads.config";

type Tx = { to: string; nano: string; payload?: string };
type Ctx = {
  ready: boolean;
  address: string;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  send: (tx: Tx) => Promise<void>;
};

const TonCtx = createContext<Ctx | null>(null);

// TON Connect is browser-only, so the library is loaded after hydration.
export function TonConnectProvider({ children }: { children: ReactNode }) {
  const ui = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [address, setAddress] = useState("");

  useEffect(() => {
    let off: (() => void) | undefined;
    import("@tonconnect/ui").then(({ TonConnectUI, toUserFriendlyAddress }) => {
      if (ui.current) return;
      const inst = new TonConnectUI({ manifestUrl: `${APP_URL}/tonconnect-manifest.json` });
      inst.uiOptions = { actionsConfiguration: { twaReturnUrl: `https://t.me/${BOT_USERNAME}` } };
      ui.current = inst;
      const apply = (w: any) => setAddress(w?.account?.address ? toUserFriendlyAddress(w.account.address, w.account.chain === "-3") : "");
      off = inst.onStatusChange(apply);
      inst.connectionRestored.then(() => { apply(inst.wallet); setReady(true); });
    }).catch(() => setReady(true));
    return () => off?.();
  }, []);

  const connect = useCallback(async () => { await ui.current?.openModal(); }, []);
  const disconnect = useCallback(async () => { await ui.current?.disconnect(); }, []);
  const send = useCallback(async (tx: Tx) => {
    if (!ui.current) throw new Error("not_ready");
    if (!ui.current.connected) { await ui.current.openModal(); throw new Error("connect_first"); }
    await ui.current.sendTransaction({
      validUntil: Math.floor(Date.now() / 1000) + 600,
      messages: [{ address: tx.to, amount: tx.nano, payload: tx.payload }],
    });
  }, []);

  return <TonCtx.Provider value={{ ready, address, connect, disconnect, send }}>{children}</TonCtx.Provider>;
}

export function useTon() {
  const c = useContext(TonCtx);
  if (!c) throw new Error("useTon outside provider");
  return c;
}

export function shortAddr(a: string) {
  return a ? `${a.slice(0, 4)}…${a.slice(-4)}` : "";
}
