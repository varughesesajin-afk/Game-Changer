import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const CONTACT = "varughesesajin@gmail.com";

/** Plain-language privacy policy (required by Google for "Sign in with Google" apps). */
export default function Privacy() {
  return (
    <div className="space-y-5 px-5 pb-10 pt-6 lg:mx-auto lg:max-w-3xl lg:px-6 lg:pt-10" data-testid="privacy-page">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-ice hover:underline">
        <ArrowLeft className="size-4" /> Back to Green Ocean
      </Link>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-energy">Legal</div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="mt-1 text-xs text-slate-500">Green Ocean Sporting Events · last updated 12 November 2026</p>
      </div>

      <section className="space-y-2 text-sm text-slate-300">
        <h2 className="font-heading text-lg font-bold text-white">What this app is</h2>
        <p>Green Ocean Sporting Events is a website where players join community games and tournaments, and hosts run them. It is run by Green Ocean Sports Management (VM Global Investments), Oman.</p>
      </section>

      <section className="space-y-2 text-sm text-slate-300">
        <h2 className="font-heading text-lg font-bold text-white">What we collect</h2>
        <p>When you sign in with Google we receive your <span className="font-semibold text-white">name, email address and profile picture</span>. We use them only to create your account, show your name on team sheets and rosters, and let you manage your games and communities. We do not receive your Google password.</p>
        <p>We also store what you do in the app: communities and games you join, teams you register, match results and fees recorded by hosts, and any photos you choose to upload (a profile picture, a community cover or gallery photo).</p>
      </section>

      <section className="space-y-2 text-sm text-slate-300">
        <h2 className="font-heading text-lg font-bold text-white">Who can see it</h2>
        <p>Your name and picture are visible to other players in the communities, games and tournaments you take part in. Community hosts and the site admin can see members' names and, where a match fee is tracked, whether it is paid. Your email address is visible only to the site admin. We do not sell your data and we do not show ads.</p>
      </section>

      <section className="space-y-2 text-sm text-slate-300">
        <h2 className="font-heading text-lg font-bold text-white">Cookies</h2>
        <p>We use one essential cookie that keeps you signed in. We do not use advertising or tracking cookies.</p>
      </section>

      <section className="space-y-2 text-sm text-slate-300">
        <h2 className="font-heading text-lg font-bold text-white">Where it is stored</h2>
        <p>Data is stored in a MongoDB Atlas database and the site runs on Render. Both are professional hosting providers that keep data in secured data centres.</p>
      </section>

      <section className="space-y-2 text-sm text-slate-300">
        <h2 className="font-heading text-lg font-bold text-white">Your choices</h2>
        <p>You can sign out at any time from the Profile page. To see, correct or delete your account and the data linked to it, email <a className="text-ice hover:underline" href={`mailto:${CONTACT}`}>{CONTACT}</a> and we will act on it. You can also remove this app's access to your Google account at <span className="text-white">myaccount.google.com/permissions</span>.</p>
      </section>

      <section className="space-y-2 text-sm text-slate-300">
        <h2 className="font-heading text-lg font-bold text-white">Contact</h2>
        <p>Questions about this policy: <a className="text-ice hover:underline" href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>
      </section>
    </div>
  );
}
