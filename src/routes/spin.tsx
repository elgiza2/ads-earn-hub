import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Page, Card } from "@/components/ads/Shell";
import { Coin } from "@/components/ads/Coin";
import { useApp, haptic, errMsg } from "@/lib/app-context";
import { spin, buyTickets } from "@/lib/ads.functions";
import { WHEEL, TICKET_PACKS, fmt } from "@/lib/ads.config";

export const Route = createFileRoute("/spin")({
  head: () => ({
    meta: [
      { title: "ADS — Roulette" },
      { name: "description", content: "Spin the ADS roulette with your tickets and win random crypto rewards." },
      { property: "og:title", content: "ADS — Roulette" },
      { property: "og:description", content: "Spin the ADS roulette with your tickets and win random crypto rewards." },
    ],
  }),
  component: Spin,
});

const SEG = 360 / WHEEL.length;

function Spin() {
  const { state, setState, initData, t } = useApp();
  const u = state!.user;
  const [rot, setRot] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [win, setWin] = useState<{ currency: string; amount: number } | null>(null);
  const [buying, setBuying] = useState<string | null>(null);

  async function go() {
    if (u.tickets < 1) { toast(t("no_tickets")); return; }
    haptic();
    setSpinning(true);
    setWin(null);
    try {
      const r = await spin({ data: { initData } });
      const target = 360 - (r.index * SEG + SEG / 2);
      const next = rot - (rot % 360) + 360 * 6 + target;
      setRot(next);
      setTimeout(() => {
        setState(r.state);
        setWin({ currency: r.currency, amount: r.amount });
        setSpinning(false);
        haptic("success");
      }, 4200);
    } catch (e) {
      setSpinning(false);
      toast(errMsg(e) === "no_tickets" ? t("no_tickets") : t("error"));
    }
  }

  async function buy(pack: string) {
    setBuying(pack);
    try {
      setState(await buyTickets({ data: { initData, pack } }));
      haptic("success");
    } catch (e) {
      toast(errMsg(e) === "insufficient" ? t("insufficient") : t("error"));
    } finally {
      setBuying(null);
    }
  }

  const R = 146;
  const pt = (deg: number, r = R) => {
    const a = (deg * Math.PI) / 180;
    return `${150 + r * Math.sin(a)} ${150 - r * Math.cos(a)}`;
  };

  return (
    <Page title={t("spin_title")} sub={t("spin_sub")}>
      <div className="relative mx-auto mt-2 aspect-square w-full max-w-[340px]">
        <div className="pointer-events-none absolute inset-6 rounded-full bg-accent/50 blur-3xl" />

        <div className="glass-strong absolute inset-0 rounded-full p-3 shadow-2xl">
          {Array.from({ length: 24 }).map((_, i) => (
            <span
              key={i}
              className={`absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-foreground ${spinning ? "animate-pulse" : ""}`}
              style={{
                transform: `rotate(${i * 15}deg) translateY(calc(-50% - min(42.5vw, 163px)))`,
                marginLeft: -3, marginTop: -3,
                opacity: i % 2 ? 0.35 : 0.95,
                animationDelay: `${(i % 4) * 120}ms`,
              }}
            />
          ))}

          <div
            className="relative h-full w-full"
            style={{ transform: `rotate(${rot}deg)`, transition: spinning ? "transform 4s cubic-bezier(.15,.75,.1,1)" : "none" }}
          >
            <svg viewBox="0 0 300 300" className="h-full w-full drop-shadow-xl">
              {WHEEL.map((seg, i) => (
                <path
                  key={i}
                  d={`M150 150 L${pt(i * SEG)} A${R} ${R} 0 0 1 ${pt((i + 1) * SEG)} Z`}
                  fill={seg.jackpot ? "var(--foreground)" : i % 2 ? "var(--accent)" : "oklch(0.3 0.12 264)"}
                  stroke="oklch(1 0 0 / 0.25)"
                  strokeWidth={1}
                />
              ))}
              <circle cx="150" cy="150" r={R} fill="none" stroke="oklch(1 0 0 / 0.35)" strokeWidth={2} />
            </svg>
            {WHEEL.map((seg, i) => (
              <div key={i} className="absolute left-1/2 top-0 h-1/2 origin-bottom" style={{ transform: `translateX(-50%) rotate(${i * SEG + SEG / 2}deg)` }}>
                <div className={`flex flex-col items-center gap-1 pt-4 ${seg.jackpot ? "text-background" : "text-foreground"}`}>
                  <Coin c={seg.c} size={22} />
                  <span className="text-[11px] font-bold tabular-nums">{fmt(seg.a, seg.c)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-1">
          <svg width="34" height="42" viewBox="0 0 34 42" className="drop-shadow-lg">
            <path d="M17 41 L3 14 A15 15 0 1 1 31 14 Z" fill="var(--foreground)" />
            <circle cx="17" cy="15" r="6" fill="var(--accent)" />
          </svg>
        </div>

        <button
          onClick={go}
          disabled={spinning}
          className="absolute left-1/2 top-1/2 z-20 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border-4 border-accent bg-foreground text-background shadow-2xl transition active:scale-90 disabled:opacity-90"
        >
          <span className="text-lg font-bold uppercase tracking-wider">{t("spin_btn")}</span>
          <span className="text-[11px] tabular-nums opacity-70">{u.tickets}</span>
        </button>
      </div>

      <div className="mt-6 min-h-[76px]">
        {win ? (
          <Card className="flex items-center gap-4 !p-4 animate-in zoom-in-90">
            <Coin c={win.currency} size={44} />
            <div>
              <div className="text-xs text-muted-foreground">{t("you_won")}</div>
              <div className="text-2xl tabular-nums">+{fmt(win.amount, win.currency)} {win.currency}</div>
            </div>
          </Card>
        ) : (
          <button className="pill-btn w-full !py-4 text-base" disabled={spinning} onClick={go}>
            {spinning ? "…" : `${t("tap_to_spin")} · ${t("tickets_n", u.tickets)}`}
          </button>
        )}
      </div>

      <h2 className="mb-3 mt-7 text-xl font-normal">{t("buy_tickets")}</h2>
      <div className="grid grid-cols-3 gap-3">
        {TICKET_PACKS.map((p) => (
          <button key={p.key} disabled={buying === p.key} onClick={() => buy(p.key)} className="glass rounded-2xl p-4 text-center transition active:scale-95">
            <div className="text-2xl font-normal">{p.tickets}</div>
            <div className="text-xs text-muted-foreground">{t("tickets")}</div>
            <div className="mt-3 flex items-center justify-center gap-1 text-sm font-normal">
              <Coin c="GRAM" size={16} /> {fmt(p.gram)}
            </div>
          </button>
        ))}
      </div>
    </Page>
  );
}
