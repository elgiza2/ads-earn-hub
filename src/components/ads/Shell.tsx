import type { ReactNode } from "react";
import { useApp } from "@/lib/app-context";
import { Coin } from "./Coin";
import { fmt } from "@/lib/ads.config";

export function Page({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-md px-4 pb-32 pt-5">
      <header className="mb-5">
        <h1 className="text-[34px] font-bold leading-tight tracking-tight">{title}</h1>
        {sub && <p className="mt-1 text-[15px] text-muted-foreground">{sub}</p>}
      </header>
      {children}
    </main>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`glass rounded-3xl p-5 ${className}`}>{children}</section>;
}

export function BalanceStrip() {
  const { state } = useApp();
  const u = state?.user;
  if (!u) return null;
  return (
    <div className="glass mb-4 flex items-center justify-between rounded-full px-4 py-2.5">
      {(["USDT", "GRAM", "ADS"] as const).map((c) => (
        <div key={c} className="flex items-center gap-2">
          <Coin c={c} size={22} />
          <span className="text-sm font-semibold tabular-nums">{fmt(Number(u[c.toLowerCase() as "usdt"]), c)}</span>
        </div>
      ))}
    </div>
  );
}
