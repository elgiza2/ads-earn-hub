import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Page, Card } from "@/components/ads/Shell";
import { Coin } from "@/components/ads/Coin";
import { useApp, haptic, errMsg } from "@/lib/app-context";
import { completeTask } from "@/lib/ads.functions";
import { fmt } from "@/lib/ads.config";

export const Route = createFileRoute("/tasks")({
  head: () => ({
    meta: [
      { title: "ADS — Tasks" },
      { name: "description", content: "Complete tasks and earn GRAM and USDT rewards." },
      { property: "og:title", content: "ADS — Tasks" },
      { property: "og:description", content: "Complete tasks and earn GRAM and USDT rewards." },
    ],
  }),
  component: Tasks,
});

function Tasks() {
  const { state, setState, initData, t } = useApp();
  const u = state!.user;
  const [busy, setBusy] = useState<string | null>(null);
  const [opened, setOpened] = useState<Record<string, boolean>>({});

  async function claim(key: string) {
    setBusy(key);
    try {
      setState(await completeTask({ data: { initData, key } }));
      haptic("success");
    } catch (e) {
      haptic("error");
      const m = errMsg(e);
      toast(m === "not_joined" ? t("not_joined") : m === "not_ready" ? t("not_ready") : t("error"));
    } finally {
      setBusy(null);
    }
  }

  function open(task: any) {
    setOpened((o) => ({ ...o, [task.key]: true }));
    const wa = window.Telegram?.WebApp;
    if (task.link?.startsWith("https://t.me/")) wa?.openTelegramLink(task.link);
    else if (task.link) wa?.openLink(task.link);
  }

  return (
    <Page title={t("tasks_title")} sub={t("tasks_sub")}>
      <div className="space-y-3">
        {state!.tasks.map((task: any) => {
          const done = state!.done.includes(task.key);
          const progress = task.kind === "watch" ? u.ads_watched : task.kind === "invite" ? u.referrals : 0;
          const ready = task.kind === "channel" ? opened[task.key] : progress >= task.target;
          return (
            <Card key={task.key} className="!p-4">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{task.title}</div>
                  <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Coin c={task.reward_currency} size={16} />
                    <span className="tabular-nums">{fmt(Number(task.reward_amount), task.reward_currency)} {task.reward_currency}</span>
                  </div>
                </div>
                {done ? (
                  <span className="rounded-full px-3 py-1.5 text-sm font-semibold text-success">{t("done")}</span>
                ) : task.kind === "channel" && !ready ? (
                  <button className="pill-ghost !py-2 text-sm" onClick={() => open(task)}>{t("open")}</button>
                ) : (
                  <button className="pill-btn !px-4 !py-2 text-sm" disabled={!ready || busy === task.key} onClick={() => claim(task.key)}>
                    {task.kind === "channel" ? t("check") : t("claim")}
                  </button>
                )}
              </div>
              {task.target > 0 && !done && (
                <div className="mt-3">
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.min(100, (progress / task.target) * 100)}%` }} />
                  </div>
                  <div className="mt-1 text-xs tabular-nums text-muted-foreground">{Math.min(progress, task.target)} / {task.target}</div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </Page>
  );
}
