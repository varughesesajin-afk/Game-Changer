// Shared helpers for the community + profile pages. Google sign-in helpers
// (whoAmI, signInUrl, signInButtonHtml, readLoginError, renderHeaderAuth)
// now live in api.js, since every page loads that script, not just these.

function fmtTime(t) {
  if (!t) return "";
  const [h, m] = String(t).split(":").map(Number);
  if (Number.isNaN(h)) return t;
  const d = new Date();
  d.setHours(h, m || 0, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
