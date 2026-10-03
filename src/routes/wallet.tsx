import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Page, Card } from "@/components/ads/Shell";
import { Coin } from "@/components/ads/Coin";
import { useApp, haptic, errMsg } from "@/lib/app-context";
import { requestWithdraw, createBoosterPayment, checkPayment } from "@/lib/ads.functions";
import { BOOSTERS, MIN_WITHDRAW, fmt, type Currency } from "@/lib/ads.config";

export const Route = createFileRoute("/wallet")({
  head: () => ({
    meta: [
      { title: "ADS — Wallet" },
      { name: "description", content: "Your USDT, GRAM and ADS balances, withdrawals and boosters." },
      { property: "og:title", content: "ADS — Wallet" },
      { property: "og:description", content: "Your USDT, GRAM and ADS balances, withdrawals and boosters." },
    ],
  }),
  component: Wallet,
});

function Wallet() {
  const { state, setState, initData, t } = useApp();
  const u = state!.user;
  const [sel, setSel] = useState<Currency | null>(null);
  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [pay, setPay] = useState<{ memo: string; link: string; amount: number } | null>(null);

  async function withdraw() {
    if (!sel) return;
    setBusy(true);
    try {
      setState(await requestWithdraw({ data: { initData, currency: sel, amount: Number(amount), address: address.trim() } }));
      toast(t("withdraw_sent"));
      haptic("success");
      setSel(null); setAmount(""); setAddress("");
    } catch (e) {
      const m = errMsg(e);
      toast(m === "insufficient" ? t("insufficient") : m === "min" ? t("min_withdraw", MIN_WITHDRAW) : t("error"));
    } finally { setBusy(false); }
  }

  async function startBooster(key: string) {
    setBusy(true);
    try {
      const p = await createBoosterPayment({ data: { initData, booster: key } });
      setPay(p);
      window.Telegram?.WebApp?.openLink(p.link);
    } catch { toast(t("error")); } finally { setBusy(false); }
  }

  async function verify() {
    if (!pay) return;
    setBusy(true);
    try {
      const r = await checkPayment({ data: { initData, memo: pay.memo } });
      if (r.paid && r.state) { setState(r.state); setPay(null); toast(t("booster_on")); haptic("success"); }
      else toast(t("payment_pending"));
    } catch { toast(t("error")); } finally { setBusy(false); }
  }

  const statusLabel = (s: string) => (s === "paid" ? t("paid") : s === "rejected" ? t("rejected") : t("pending"));

  return (
    <Page title={t("wallet_title")}>
      <Card className="!p-2">
        {(["USDT", "GRAM", "ADS"] as const).map((c) => (
          <button key={c} onClick={() => setSel(sel === c ? null : c)} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3.5 text-start transition active:bg-muted">
            <Coin c={c} size={40} />
            <div className="flex-1">
              <div className="font-normal">{c}</div>
              <div className="text-xs text-muted-foreground">{t("withdraw")}</div>
            </div>
            <div className="text-xl font-normal tabular-nums">{fmt(Number(u[c.toLowerCase() as "usdt"]), c)}</div>
          </button>
        ))}
      </Card>

      {sel && (
        <Card className="mt-4 animate-in fade-in slide-in-from-top-2">
          <div className="mb-3 flex items-center gap-2 font-normal"><Coin c={sel} size={22} /> {t("withdraw")} {sel}</div>
          <input inputMode="decimal" placeholder={`${t("amount")} · ${t("min_withdraw", MIN_WITHDRAW)}`} value={amount} onChange={(e) => setAmount(e.target.value)} className="glass-strong mb-3 w-full rounded-2xl bg-transparent px-4 py-3.5 outline-none placeholder:text-muted-foreground" />
          <input placeholder={t("address")} value={address} onChange={(e) => setAddress(e.target.value)} dir="ltr" className="glass-strong mb-4 w-full rounded-2xl bg-transparent px-4 py-3.5 outline-none placeholder:text-muted-foreground" />
          <button className="pill-btn w-full" disabled={busy || !amount || address.length < 10} onClick={withdraw}>{t("submit")}</button>
        </Card>
      )}

      <h2 className="mb-1 mt-7 text-xl font-normal">{t("boosters")}</h2>
      <p className="mb-3 text-sm text-muted-foreground">{t("boosters_sub")}</p>
      {u.mult > 1 && <p className="mb-3 text-sm font-normal text-accent">{t("booster_active", u.mult)}</p>}
      <div className="grid grid-cols-3 gap-3">
        {BOOSTERS.map((b) => (
          <button key={b.key} disabled={busy} onClick={() => startBooster(b.key)} className="glass rounded-2xl p-4 text-center transition active:scale-95">
            <div className="text-2xl font-normal">×{b.mult}</div>
            <div className="text-xs text-muted-foreground">{t("days", b.days)}</div>
            <div className="mt-3 flex items-center justify-center gap-1 text-sm font-normal"><Coin c="TON" size={16} /> {b.ton}</div>
          </button>
        ))}
      </div>

      {pay && (
        <Card className="mt-4">
          <div className="flex items-center gap-2 font-normal"><Coin c="TON" size={20} /> {pay.amount} TON</div>
          <div className="glass-strong mt-3 rounded-2xl px-4 py-3 font-mono text-sm" dir="ltr">{pay.memo}</div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button className="pill-ghost" onClick={() => window.Telegram?.WebApp?.openLink(pay.link)}>{t("pay_ton")}</button>
            <button className="pill-btn" disabled={busy} onClick={verify}>{t("verify_payment")}</button>
          </div>
        </Card>
      )}

      {state!.withdrawals.length > 0 && (
        <>
          <h2 className="mb-3 mt-7 text-xl font-normal">{t("history")}</h2>
          <Card className="!p-2">
            {state!.withdrawals.map((w: any) => (
              <div key={w.id} className="flex items-center gap-3 border-b border-border px-3 py-3 last:border-0">
                <Coin c={w.currency} size={28} />
                <div className="flex-1 text-sm tabular-nums">{fmt(Number(w.amount), w.currency)} {w.currency}</div>
                <span className={`text-sm font-medium ${w.status === "paid" ? "text-success" : w.status === "rejected" ? "text-destructive" : "text-muted-foreground"}`}>{statusLabel(w.status)}</span>
              </div>
            ))}
          </Card>
        </>
      )}
    </Page>
  );
}
