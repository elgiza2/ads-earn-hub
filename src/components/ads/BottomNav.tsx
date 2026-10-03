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
    <nav className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(env(safe-area-inset-bottom),14px)]">
      <div className="glass mx-auto flex max-w-md items-center gap-1 rounded-2xl p-1.5">
        {ITEMS.map(({ to, icon: Icon, k }) => (
          <Link
            key={to}
            to={to}
            onClick={() => haptic()}
            className="group flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[10px] text-foreground/80 transition-transform duration-200 active:scale-95"
            activeOptions={{ exact: true }}
            activeProps={{ className: "bg-primary !text-primary-foreground shadow-lg" }}
          >
            {({ isActive }) => (
              <>
                <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${isActive ? "bg-accent text-accent-foreground" : ""}`}>
                  <Icon size={16} strokeWidth={2} />
                </span>
                {t(k)}
              </>
            )}
          </Link>
        ))}
      </div>
    </nav>
  );
}
