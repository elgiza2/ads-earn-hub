import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Play } from "lucide-react";
import { toast } from "sonner";
import { Page, Card, BalanceStrip } from "@/components/ads/Shell";
import { Coin } from "@/components/ads/Coin";
import { useApp, haptic, errMsg } from "@/lib/app-context";
import { claimAd } from "@/lib/ads.functions";
import { AD_COOLDOWN_SEC, MONETAG_ZONE, fmt } from "@/lib/ads.config";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ADS — Watch & earn" },
      { name: "description", content: "Watch ads and earn USDT, GRAM or ADS plus roulette tickets." },
      { property: "og:title", content: "ADS — Watch & earn" },
      { property: "og:description", content: "Watch ads and earn USDT, GRAM or ADS plus roulette tickets." },
    ],
  }),
  component: Earn,
});

function Earn() {
  const { state, setState, initData, t } = useApp();
  const u = state!.user;
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const [last, setLast] = useState<{ currency: string; amount: number } | null>(null);

  useEffect(() => {
    if (!u.last_ad_at) return;
    const left = Math.ceil(AD_COOLDOWN_SEC - (Date.now() - new Date(u.last_ad_at).getTime()) / 1000);
    if (left > 0) setWait(left);
  }, [u.last_ad_at]);

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  async function watch() {
    haptic();
    setBusy(true);
    try {
      const show = window[`show_${MONETAG_ZONE}`];
      if (typeof show !== "function") throw new Error("ad");
      await show();
      const r = await claimAd({ data: { initData } });
      setState(r.state);
      setLast({ currency: r.currency, amount: r.amount });
      setWait(AD_COOLDOWN_SEC);
      haptic("success");
    } catch (e) {
      haptic("error");
      const m = errMsg(e);
      toast(m === "cooldown" ? t("cooldown") : t("ad_failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page title={`${t("hello")}, ${u.first_name ?? ""}`} sub={t("watch_sub")}>
      <BalanceStrip />

      <Card className="relative overflow-hidden text-center">
        <div className="label-caps">{t("watch_title")}</div>
        <div className="mx-auto my-6 flex h-40 w-40 items-center justify-center rounded-full liquid-glass" style={{ background: "var(--glass-strong)" }}>
          {last ? (
            <div className="flex flex-col items-center gap-2 animate-in zoom-in-50 duration-300">
              <Coin c={last.currency} size={44} />
              <div className="text-2xl font-normal tabular-nums">+{fmt(last.amount, last.currency)}</div>
              <div className="text-xs text-muted-foreground">{last.currency}</div>
            </div>
          ) : (
            <div className="text-5xl font-normal tracking-tighter">ADS</div>
          )}
        </div>
        {last && <p className="mb-4 text-sm font-medium text-success">{t("plus_ticket")}</p>}
        <button className="pill-accent w-full justify-start" disabled={busy || wait > 0} onClick={watch}>
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-foreground"><Play size={18} strokeWidth={2.5} /></span>
          {busy ? t("loading_ad") : wait > 0 ? t("wait_btn", wait) : t("watch_btn")}
        </button>
        {u.mult > 1 && <p className="mt-3 text-sm font-normal text-accent">{t("booster_active", u.mult)}</p>}
      </Card>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Card>
          <div className="label-caps">{t("ads_watched")}</div>
          <div className="mt-1 text-3xl font-normal tabular-nums">{u.ads_watched.toLocaleString()}</div>
        </Card>
        <Card>
          <div className="label-caps">{t("tickets")}</div>
          <div className="mt-1 text-3xl font-normal tabular-nums">{u.tickets}</div>
        </Card>
      </div>

      <Card className="mt-4">
        <p className="text-[15px] leading-relaxed">{t("tip")}</p>
      </Card>
    </Page>
  );
}
