import { NavLink, Outlet, useLocation } from "react-router-dom";
import { motion } from "motion/react";
import { Flame, Sparkles, Trophy, User as UserIcon, Users } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "explore", label: "Explore", icon: Flame, to: "/" },
  { id: "communities", label: "Groups", icon: Users, to: "/communities" },
  { id: "tournaments", label: "Tourneys", icon: Trophy, to: "/tournaments" },
  { id: "host", label: "Host & Earn", icon: Sparkles, to: "/monetize" },
  { id: "profile", label: "My Games", icon: UserIcon, to: "/profile" },
];

export default function AppShell() {
  const location = useLocation();
  return (
    <div className="relative mx-auto min-h-screen w-full max-w-md border-x border-[#1E293B]/40 bg-page pb-24 shadow-2xl shadow-black/60">
      <motion.main
        key={location.pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
      >
        <Outlet />
      </motion.main>
      <nav
        data-testid="bottom-nav"
        className="fixed bottom-0 left-0 right-0 z-50 mx-auto flex h-16 max-w-md items-center justify-around border-t border-line bg-page/90 px-2 backdrop-blur-xl"
      >
        {TABS.map(({ id, label, icon: Icon, to }) => (
          <NavLink
            key={id}
            to={to}
            end={to === "/"}
            data-testid={`nav-${id}`}
            className={({ isActive }) =>
              cn(
                "relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold uppercase tracking-wider transition-colors duration-200",
                isActive ? "text-energy" : "text-slate-500 hover:text-slate-300",
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span layoutId="nav-dot" className="absolute -top-px h-0.5 w-8 rounded-full bg-energy" />
                )}
                <Icon className="size-5" strokeWidth={isActive ? 2.4 : 1.8} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <Toaster position="bottom-right" theme="dark" richColors />
    </div>
  );
}
