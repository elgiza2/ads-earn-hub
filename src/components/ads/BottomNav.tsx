import { Link } from "@tanstack/react-router";
import { Play, ListChecks, Disc3, Users, Wallet } from "lucide-react";
import { useApp, haptic } from "@/lib/app-context";

const ITEMS = [
  { to: "/", icon: Play, k: "nav_earn" },
  { to: "/tasks", icon: ListChecks, k: "nav_tasks" },
  { to: "/spin", icon: Disc3, k: "nav_spin" },
  { to: "/friends", icon: Users, k: "nav_friends" },
  { to: "/wallet", icon: Wallet, k: "nav_wallet" },
] as const;

export function BottomNav() {
  const { t } = useApp();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(env(safe-area-inset-bottom),12px)]">
      <div className="glass-strong mx-auto flex max-w-md items-center justify-between rounded-full p-1.5">
        {ITEMS.map(({ to, icon: Icon, k }) => (
          <Link
            key={to}
            to={to}
            onClick={() => haptic()}
            className="flex flex-1 flex-col items-center gap-0.5 rounded-full py-2 text-[10px] font-semibold text-muted-foreground transition-colors"
            activeOptions={{ exact: true }}
            activeProps={{ className: "bg-glass-strong text-foreground" }}
          >
            <Icon className="h-5 w-5" strokeWidth={2.2} />
            {t(k)}
          </Link>
        ))}
      </div>
    </nav>
  );
}
