import { Navigate, useSearchParams } from "react-router-dom";
import { motion } from "motion/react";
import { CalendarCheck, Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HERO_IMG, loginWithGoogle, useMe } from "@/lib/auth";

const LOGIN_ERRORS: Record<string, string> = {
  not_configured: "Google sign-in isn't set up on this site yet — the site owner needs to add the Google keys.",
  denied: "Google sign-in was cancelled. Tap the button to try again.",
  unverified: "That Google account's email isn't verified, so it can't be used here.",
  failed: "Google sign-in didn't work. Please try again.",
};

export default function Login() {
  const { data: me } = useMe();
  const [params] = useSearchParams();
  const errorText = LOGIN_ERRORS[params.get("error") ?? ""] ?? null;
  if (me) return <Navigate to="/profile" replace />;
  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden" data-testid="auth-modal">
      <img src={HERO_IMG} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />
      <div className="absolute inset-0 bg-gradient-to-b from-page/40 via-page/90 to-page" />
      <div className="relative flex min-h-[calc(100vh-4rem)] flex-col justify-end space-y-6 p-6 pb-10">
        <img src="/logo-512.jpg" alt="Green Ocean Sporting Events" data-testid="login-logo" className="w-40 rounded-3xl shadow-2xl shadow-black/50 ring-1 ring-white/10" />
        <h1 className="font-heading text-4xl font-bold leading-[1.05] tracking-tight">Game on.<br /><span className="text-brand">Get on the team sheet.</span></h1>
        <ul className="space-y-2 text-sm text-slate-300">
          <li className="flex items-center gap-2"><CalendarCheck className="size-4 text-ice" />Add your name to weekly games in one tap</li>
          <li className="flex items-center gap-2"><Users className="size-4 text-ice" />Join groups & build tournament squads</li>
          <li className="flex items-center gap-2"><Trophy className="size-4 text-ice" />Play official Green Ocean tournaments</li>
        </ul>
        {errorText && (
          <p data-testid="login-error" role="alert" className="rounded-xl border border-red-400/40 bg-red-400/10 px-3 py-2 text-sm text-red-200">{errorText}</p>
        )}
        <motion.div whileTap={{ scale: 0.96 }}>
          <Button data-testid="google-login-button" size="lg" className="h-12 w-full bg-white text-base font-semibold text-slate-900 hover:bg-slate-100" onClick={loginWithGoogle}>
            <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
              <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z" />
            </svg>
            Continue with Google
          </Button>
        </motion.div>
        <p className="text-center text-xs text-slate-500">WhatsApp sign-in coming soon.</p>
      </div>
    </div>
  );
}
