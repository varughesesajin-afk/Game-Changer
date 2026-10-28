// Shared helpers for the community pages. There's no visitor login on the
// public site (same as Match Days), so "My communities" is tracked locally
// in this browser only — joining from another device won't show up here,
// but the membership itself is recorded on the server either way.

const JOINED_KEY = "gad_joined_communities";

function myCommunityIds() {
  try {
    const raw = localStorage.getItem(JOINED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function markCommunityJoined(id) {
  try {
    const ids = myCommunityIds();
    if (!ids.includes(id)) {
      ids.push(id);
      localStorage.setItem(JOINED_KEY, JSON.stringify(ids));
    }
  } catch (e) {
    // localStorage unavailable — joining still works server-side, just won't be remembered locally.
  }
}

function fmtTime(t) {
  if (!t) return "";
  const [h, m] = String(t).split(":").map(Number);
  if (Number.isNaN(h)) return t;
  const d = new Date();
  d.setHours(h, m || 0, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
