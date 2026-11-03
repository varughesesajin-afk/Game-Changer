const api = {
  async _req(method, url, body) {
    const opts = { method, headers: {} };
    if (body !== undefined) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(url, opts);
    let data = null;
    try {
      data = await res.json();
    } catch (e) {
      data = null;
    }
    if (!res.ok) {
      const err = new Error((data && data.error) || `Request failed (${res.status})`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  },
  get(url) { return this._req("GET", url); },
  post(url, body) { return this._req("POST", url, body ?? {}); },
  patch(url, body) { return this._req("PATCH", url, body ?? {}); },
  del(url) { return this._req("DELETE", url); },
};

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function fmtDateOnly(iso) {
  if (!iso) return "";
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

const STATUS_LABELS = {
  draft: "Draft",
  registration_open: "Registration open",
  registration_closed: "Registration closed",
  fixtures_set: "Fixtures set",
  in_progress: "In progress",
  completed: "Completed",
};

function statusBadgeClass(status) {
  if (status === "registration_open") return "accent";
  if (status === "completed") return "";
  if (status === "draft") return "warning";
  return "";
}

// There's no "Organizer" tab in the main nav — the admin dashboard is reached
// via a small footer link instead. On content the organizer manages (events,
// match days, communities, games), we show a "Manage" shortcut straight into
// the admin view, but only once we've confirmed this browser is already
// logged in as the site admin — regular visitors never see it.
let _isAdminCache = null;
async function checkIsAdmin(force) {
  if (_isAdminCache !== null && !force) return _isAdminCache;
  try {
    const r = await api.get("/api/admin/session");
    _isAdminCache = !!(r && r.isAdmin);
  } catch (e) {
    _isAdminCache = false;
  }
  return _isAdminCache;
}

function manageLinkHtml(hash, label) {
  return `<a href="/admin.html${hash}" class="small" style="display:inline-block; margin-top:10px;">⚙️ ${escapeHtml(label || "Manage")}</a>`;
}

function sportImageUrl(sportKey) {
  const known = [
    "football", "futsal", "cricket", "basketball", "volleyball", "kabaddi", "hockey", "handball",
    "rugby", "baseball", "badminton", "tennis", "table_tennis", "squash", "padel", "chess",
    "carrom", "athletics", "swimming", "other_team", "other_individual",
  ];
  const key = known.includes(sportKey) ? sportKey : "default";
  return `/images/sports/${key}.svg`;
}

// ----- Google sign-in helpers, shared by every page (not just community
// pages) so the header can show a sign-in state anywhere. -----

let _meCache = null;

async function whoAmI(force) {
  if (_meCache && !force) return _meCache;
  _meCache = await api.get("/api/auth/me");
  return _meCache;
}

function signInUrl(next) {
  const target = next || location.pathname + location.search;
  return `/api/auth/google/login?next=${encodeURIComponent(target)}`;
}

function signInButtonHtml(label) {
  return `<a class="btn" href="${signInUrl()}">${escapeHtml(label || "Continue with Google")}</a>`;
}

function readLoginError() {
  const params = new URLSearchParams(location.search);
  const msg = params.get("loginError");
  if (msg) {
    params.delete("loginError");
    const qs = params.toString();
    history.replaceState(null, "", location.pathname + (qs ? `?${qs}` : ""));
  }
  return msg;
}

// Fills the shared #header-auth slot (present in the topbar on every page)
// with either a "Sign in" pill or a small logged-in avatar/name link to
// My Games — no per-page wiring needed, just include api.js.
async function renderHeaderAuth() {
  const slot = document.getElementById("header-auth");
  if (!slot) return;
  try {
    const me = await whoAmI();
    if (me && me.user) {
      const initial = escapeHtml((me.user.name || "?").trim().charAt(0).toUpperCase() || "?");
      slot.innerHTML = `
        <a href="/profile.html" class="header-auth-user" title="${escapeHtml(me.user.name || "")}">
          ${me.user.picture
            ? `<img src="${escapeHtml(me.user.picture)}" alt="" class="header-avatar">`
            : `<span class="header-avatar header-avatar-fallback">${initial}</span>`}
        </a>`;
    } else {
      slot.innerHTML = `<a href="${signInUrl()}" class="header-auth-pill">Sign in</a>`;
    }
  } catch (e) {
    slot.innerHTML = `<a href="${signInUrl()}" class="header-auth-pill">Sign in</a>`;
  }
}

document.addEventListener("DOMContentLoaded", renderHeaderAuth);
