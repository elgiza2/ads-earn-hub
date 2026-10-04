import type { ReactNode } from "react";
import { useApp } from "@/lib/app-context";
import { Coin } from "./Coin";
import { fmt } from "@/lib/ads.config";

export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <svg viewBox="0 0 256 256" width={20} height={20} className="fill-foreground">
        <path d="M 256 256 L 128 256 C 198.692 256 256 198.692 256 128 C 256 57.308 198.692 0 128 0 C 57.308 0 0 57.308 0 128 C 0 198.692 57.308 256 128 256 L 0 256 L 0 0 L 256 0 Z M 128 104 C 141.255 104 152 114.745 152 128 C 152 141.255 141.255 152 128 152 C 114.745 152 104 141.255 104 128 C 104 114.745 114.745 104 128 104 Z" />
      </svg>
      <span className="text-base tracking-tight">ads</span>
    </div>
  );
}

export function Page({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <main className="relative z-10 mx-auto max-w-md px-4 pb-32" style={{ paddingTop: "calc(var(--tg-safe-area-inset-top, 0px) + var(--tg-content-safe-area-inset-top, 0px) + 1.5rem)" }}>
      <div className="mb-6">
        <h1 className="animate-fade-up delay-1 text-4xl leading-[1.1] tracking-tight lowercase">{title}</h1>
        {sub && <p className="animate-fade-up delay-2 mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">{sub}</p>}
      </div>
      <div className="animate-fade-up delay-3">{children}</div>
    </main>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`glass rounded-2xl p-5 ${className}`}>{children}</section>;
}

export function BalanceStrip() {
  const { state } = useApp();
  const u = state?.user;
  if (!u) return null;
  return (
    <div className="glass mb-4 flex items-center justify-between rounded-2xl px-4 py-3">
      {(["USDT", "GRAM", "ADS"] as const).map((c) => (
        <div key={c} className="flex items-center gap-2">
          <Coin c={c} size={22} />
          <span className="text-sm tabular-nums">{fmt(Number(u[c.toLowerCase() as "usdt"]), c)}</span>
        </div>
      ))}
    </div>
  );
}
