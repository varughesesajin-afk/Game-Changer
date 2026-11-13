import { useEffect } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { motion } from "motion/react";
import { Flame, Sparkles, Trophy, User as UserIcon, Users } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import ReminderBanner from "@/components/ReminderBanner";
import Brand from "@/components/Brand";
import Avatar from "@/components/Avatar";
import { useMe } from "@/lib/auth";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "explore", label: "Explore", icon: Flame, to: "/" },
  { id: "communities", label: "Community", icon: Users, to: "/communities" },
  { id: "tournaments", label: "Tourneys", icon: Trophy, to: "/tournaments" },
  { id: "host", label: "Host & Earn", icon: Sparkles, to: "/monetize" },
  { id: "profile", label: "Profile", icon: UserIcon, to: "/profile" },
];

function DesktopBar() {
  const { data: me } = useMe();
  return (
    <header data-testid="desktop-top-bar" className="sticky top-0 z-50 hidden border-b border-line/70 bg-page/90 backdrop-blur-xl lg:block">
      <div className="flex h-16 w-full items-center gap-8 px-6 xl:px-14">
        <Link to="/" aria-label="Home"><Brand /></Link>
        <nav className="flex flex-1 items-center gap-1">
          {TABS.filter((t) => t.id !== "profile").map(({ id, label, to }) => (
            <NavLink
              key={id}
              to={to}
              end={to === "/"}
              data-testid={`desktop-nav-${id}`}
              className={({ isActive }) =>
                cn(
                  "rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-200",
                  isActive ? "bg-energy/15 text-energy" : "text-slate-300 hover:bg-white/5 hover:text-white",
                )
              }
            >
              {label}
            </NavLink>
          ))}
          {me?.role === "admin" && (
            <NavLink
              to="/admin"
              data-testid="desktop-nav-admin"
              className={({ isActive }) =>
                cn("rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-200", isActive ? "bg-ice/15 text-ice" : "text-slate-300 hover:bg-white/5 hover:text-white")
              }
            >
              Admin
            </NavLink>
          )}
        </nav>
        {me ? (
          <Link to="/profile" data-testid="desktop-profile-link" className="flex items-center gap-2.5 rounded-full border border-line bg-surface py-1 pl-1 pr-4 text-sm font-semibold hover:border-energy/50">
            <Avatar name={me.name} picture={me.picture} className="size-8" />
            {me.name.split(" ")[0]}
          </Link>
        ) : (
          <Link to="/login" data-testid="desktop-signin-link" className="rounded-full bg-brand px-5 py-2 text-sm font-bold text-white hover:opacity-90">
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}

export default function AppShell() {
  const location = useLocation();
  // remember where the visitor was (e.g. a shared community link) so sign-in returns them there
  useEffect(() => {
    if (location.pathname !== "/login") sessionStorage.setItem("returnTo", location.pathname);
  }, [location.pathname]);
  return (
    <div className="min-h-screen bg-page">
    <DesktopBar />
    <div className="relative mx-auto min-h-screen w-full max-w-md border-x border-line bg-page pb-28 shadow-2xl shadow-sky-900/10 lg:min-h-[calc(100vh-4rem)] lg:max-w-none lg:border-x-0 lg:pb-12 xl:px-8 lg:shadow-none">
      <ReminderBanner />
      {["/communities", "/tournaments", "/monetize", "/profile", "/admin"].includes(location.pathname) && (
        <header data-testid="app-top-bar" className="flex items-center lg:hidden border-b border-line/60 px-5 py-3">
          <Brand tagline />
        </header>
      )}
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
        className="glass-bar fixed bottom-4 left-1/2 z-50 flex h-[4.5rem] w-[calc(100%-2rem)] max-w-[26rem] -translate-x-1/2 items-center justify-around rounded-[2rem] p-1.5 lg:hidden"
      >
        {TABS.map(({ id, label, icon: Icon, to }) => (
          <NavLink
            key={id}
            to={to}
            end={to === "/"}
            data-testid={`nav-${id}`}
            className={({ isActive }) =>
              cn(
                "relative flex h-full flex-1 flex-col items-center justify-center gap-0.5 rounded-3xl text-[10px] font-semibold tracking-wide transition-colors duration-200",
                isActive ? "text-[#ffffff]" : "text-slate-400 hover:text-slate-200",
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span layoutId="nav-glass" transition={{ type: "spring", stiffness: 420, damping: 32 }} className="glass-pill absolute inset-0 rounded-3xl" />
                )}
                <Icon className="relative size-5" strokeWidth={isActive ? 2.4 : 1.8} />
                <span className="relative">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <footer className="mt-12 hidden items-center justify-between border-t border-line/60 px-6 py-6 text-xs text-slate-500 lg:flex">
        <span>© {new Date().getFullYear()} Green Ocean Sports Management</span>
        <Link to="/privacy" className="hover:text-slate-300">Privacy policy</Link>
      </footer>
      <Toaster position="top-center" theme="light" richColors />
    </div>
    </div>
  );
}
