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

  const gradient = WHEEL.map((_, i) => `${i % 2 ? "var(--glass-strong)" : "var(--glass)"} ${i * SEG}deg ${(i + 1) * SEG}deg`).join(",");

  return (
    <Page title={t("spin_title")} sub={t("spin_sub")}>
      <Card className="text-center">
        <div className="relative mx-auto aspect-square w-full max-w-[320px]">
          <div className="absolute left-1/2 top-[-6px] z-10 h-0 w-0 -translate-x-1/2 border-x-[12px] border-t-[20px] border-x-transparent border-t-accent" />
          <div
            className="glass-strong relative h-full w-full rounded-full"
            style={{ background: `conic-gradient(${gradient})`, transform: `rotate(${rot}deg)`, transition: spinning ? "transform 4s cubic-bezier(.17,.67,.12,1)" : "none" }}
          >
            {WHEEL.map((s, i) => (
              <div key={i} className="absolute left-1/2 top-0 h-1/2 origin-bottom -translate-x-1/2" style={{ transform: `translateX(-50%) rotate(${i * SEG + SEG / 2}deg)` }}>
                <div className="flex flex-col items-center gap-1 pt-3">
                  <Coin c={s.c} size={22} />
                  <span className="text-[11px] font-bold tabular-nums">{fmt(s.a, s.c)}</span>
                </div>
              </div>
            ))}
            <div className="glass-strong absolute left-1/2 top-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-background text-lg font-black">ADS</div>
          </div>
        </div>

        <div className="mt-5 h-8">
          {win && (
            <div className="flex items-center justify-center gap-2 text-xl font-bold animate-in zoom-in-75">
              <Coin c={win.currency} size={26} /> +{fmt(win.amount, win.currency)} {win.currency}
            </div>
          )}
        </div>

        <button className="pill-accent mt-3 w-full text-lg" disabled={spinning} onClick={go}>
          {t("spin_btn")} · {t("tickets_n", u.tickets)}
        </button>
      </Card>

      <h2 className="mb-3 mt-7 text-xl font-bold">{t("buy_tickets")}</h2>
      <div className="grid grid-cols-3 gap-3">
        {TICKET_PACKS.map((p) => (
          <button key={p.key} disabled={buying === p.key} onClick={() => buy(p.key)} className="glass rounded-3xl p-4 text-center transition active:scale-95">
            <div className="text-2xl font-bold">{p.tickets}</div>
            <div className="text-xs text-muted-foreground">{t("tickets")}</div>
            <div className="mt-3 flex items-center justify-center gap-1 text-sm font-semibold">
              <Coin c="GRAM" size={16} /> {fmt(p.gram)}
            </div>
          </button>
        ))}
      </div>
    </Page>
  );
}
