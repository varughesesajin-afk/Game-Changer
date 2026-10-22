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
