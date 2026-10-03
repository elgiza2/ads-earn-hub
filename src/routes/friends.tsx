import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Page, Card } from "@/components/ads/Shell";
import { useApp, haptic } from "@/lib/app-context";

export const Route = createFileRoute("/friends")({
  head: () => ({
    meta: [
      { title: "ADS — Invite friends" },
      { name: "description", content: "Invite friends to ADS and get roulette tickets for every friend." },
      { property: "og:title", content: "ADS — Invite friends" },
      { property: "og:description", content: "Invite friends to ADS and get roulette tickets for every friend." },
    ],
  }),
  component: Friends,
});

function Friends() {
  const { state, t, botUsername } = useApp();
  const u = state!.user;
  const link = `https://t.me/${botUsername}?startapp=ref_${u.telegram_id}`;

  function copy() {
    navigator.clipboard?.writeText(link);
    haptic("success");
    toast(t("copied"));
  }
  function share() {
    const url = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(t("watch_sub"))}`;
    window.Telegram?.WebApp?.openTelegramLink(url);
  }

  return (
    <Page title={t("friends_title")} sub={t("friends_sub")}>
      <Card className="text-center">
        <div className="text-6xl font-normal tabular-nums">{u.referrals}</div>
        <div className="label-caps mt-1">{t("your_friends")}</div>
        <div className="glass-strong mt-5 truncate rounded-2xl px-4 py-3 text-sm text-muted-foreground" dir="ltr">{link}</div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button className="pill-ghost" onClick={copy}>{t("copy_link")}</button>
          <button className="pill-accent" onClick={share}>{t("share")}</button>
        </div>
      </Card>

      <h2 className="mb-3 mt-7 text-xl font-normal">{t("your_friends")}</h2>
      <Card className="!p-2">
        {state!.friends.length === 0 ? (
          <p className="p-4 text-center text-muted-foreground">{t("no_friends")}</p>
        ) : (
          state!.friends.map((f: any, i: number) => (
            <div key={i} className="flex items-center justify-between border-b border-border px-3 py-3 last:border-0">
              <span className="font-medium">{f.first_name || f.username}</span>
              <span className="text-sm text-success">+1 {t("tickets")}</span>
            </div>
          ))
        )}
      </Card>
    </Page>
  );
}
