const params = new URLSearchParams(location.search);
const gameId = params.get("id");
const content = document.getElementById("content");

let state = { game: null, community: null, claimingSlotId: null, me: null, claimError: "", isAdmin: false };

function canManage() {
  const c = state.community;
  return !!(c && (state.isAdmin || (state.me && c.hostUserId === state.me.id)));
}

async function init() {
  if (!gameId) {
    content.innerHTML = `<div class="alert error">No game specified.</div>`;
    return;
  }
  const loginError = readLoginError();
  if (loginError) state.claimError = loginError;
  try {
    await load();
  } catch (e) {
    content.innerHTML = `<div class="alert error">Couldn't load this game: ${escapeHtml(e.message)}</div>`;
  }
}

async function load() {
  const [game, me, isAdmin] = await Promise.all([api.get(`/api/community-games/${gameId}`), whoAmI(true), checkIsAdmin()]);
  state.game = game;
  state.me = me.user;
  state.isAdmin = isAdmin;
  try {
    state.community = await api.get(`/api/communities/${game.communityId}`);
  } catch (e) {
    state.community = null;
  }
  render();
}

function initials(name) {
  return String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function slotCircle(s) {
  const open = !s.playerName;
  const claiming = state.claimingSlotId === s.id;
  if (claiming) {
    if (!state.me) {
      return `
        <div class="slot-cell">
          <div class="slot-claim-form" style="display:flex; flex-direction:column; gap:4px; align-items:center;">
            <span class="small muted">Sign in to claim this spot</span>
            <a class="btn small" href="${signInUrl()}">Continue with Google</a>
            <button class="btn small secondary" type="button" data-cancel-claim>Cancel</button>
          </div>
        </div>`;
    }
    return `
      <div class="slot-cell">
        <form class="slot-claim-form" data-slot="${s.id}">
          <div class="small" style="margin-bottom:4px;">Join as ${escapeHtml(state.me.name)}?</div>
          <div style="display:flex; gap:4px;">
            <button class="btn small" type="submit">Join</button>
            <button class="btn small secondary" type="button" data-cancel-claim>✕</button>
          </div>
        </form>
      </div>
    `;
  }
  return `
    <div class="slot-cell">
      <button class="slot-circle ${open ? "slot-open" : "slot-filled"}" ${open ? `data-claim-slot="${s.id}"` : "disabled"} title="${open ? "Tap to join" : escapeHtml(s.playerName)}">
        ${open ? "+" : escapeHtml(initials(s.playerName))}
      </button>
      <div class="small muted slot-name">${open ? "Open" : escapeHtml(s.playerName)}</div>
      ${!open && canManage() ? `<button class="btn small secondary" type="button" data-clear-slot="${s.id}" style="margin-top:4px; padding:2px 8px; font-size:0.7rem;">Clear</button>` : ""}
    </div>
  `;
}

function render() {
  const g = state.game;
  const full = g.filledSlots >= g.totalSlots;
  const closed = g.status !== "open";
  const badgeClass = closed ? "" : full ? "warning" : "accent";
  const badgeLabel = closed ? (g.status === "completed" ? "Completed" : "Closed") : full ? "Full" : `${g.totalSlots - g.filledSlots} spots left`;
  const teamA = g.slots.filter((s) => s.team === "A");
  const teamB = g.slots.filter((s) => s.team === "B");

  content.innerHTML = `
    <a href="#" id="back-link" class="small">← Back</a>

    <div class="event-hero">
      <div class="event-hero-top">
        <div>
          <span class="badge">${badgeLabel}</span>
          <h1>${escapeHtml(g.title || g.sportLabel || "Game")}</h1>
          <div class="muted">${escapeHtml(g.sportLabel || "")}${g.friendly ? " · Friendly" : ""}</div>
        </div>
      </div>
      <div class="event-hero-chips">
        <div class="event-hero-chip"><span class="ehc-icon">👥</span><div><label>Format</label><div class="ehc-val">${g.teamSize}v${g.teamSize}</div></div></div>
        <div class="event-hero-chip"><span class="ehc-icon">💰</span><div><label>Entry</label><div class="ehc-val">${g.entryFee ? "AED " + g.entryFee : "Free"}${g.originalFee && g.originalFee > g.entryFee ? ` <s style="opacity:.6;">AED ${g.originalFee}</s>` : ""}</div></div></div>
        ${g.venue ? `<div class="event-hero-chip"><span class="ehc-icon">📍</span><div><label>Venue</label><div class="ehc-val">${escapeHtml(g.venue)}</div></div></div>` : ""}
        <div class="event-hero-chip"><span class="ehc-icon">📅</span><div><label>When</label><div class="ehc-val">${escapeHtml(fmtDateOnly(g.date))}${g.time ? " · " + escapeHtml(fmtTime(g.time)) : ""}</div></div></div>
      </div>
    </div>

    ${state.isAdmin ? manageLinkHtml(`#community=${g.communityId}`, "Site admin dashboard") : ""}
    ${
      canManage()
        ? `<div class="flex-between" style="margin-top:10px;">
             <span class="small muted">⚙️ You manage this game</span>
             <button class="btn small secondary" type="button" id="toggle-game-status-btn">${closed ? "Reopen" : "Close game"}</button>
           </div>`
        : ""
    }
    ${g.notes ? `<p style="margin-top:14px;">${escapeHtml(g.notes)}</p>` : ""}
    ${!closed && !full ? `<div class="alert info" style="margin-top:14px;">${g.totalSlots - g.filledSlots} spot${g.totalSlots - g.filledSlots === 1 ? "" : "s"} left to fill this game.</div>` : ""}
    ${closed ? `<div class="alert info" style="margin-top:14px;">This game is no longer open to new players.</div>` : ""}
    ${state.claimError ? `<div class="alert error" style="margin-top:14px;">${escapeHtml(state.claimError)}</div>` : ""}

    <div class="card" style="margin-top:16px;">
      <div class="flex-between" style="margin-bottom:4px;"><h3 style="margin:0;">Players</h3><span class="muted small">${g.filledSlots} / ${g.totalSlots}</span></div>
      <div class="slot-grid">
        <div class="slot-team">
          <div class="slot-team-label">Team A</div>
          <div class="slot-team-cells">${teamA.map(slotCircle).join("")}</div>
        </div>
        <div class="slot-divider"></div>
        <div class="slot-team">
          <div class="slot-team-label">Team B</div>
          <div class="slot-team-cells">${teamB.map(slotCircle).join("")}</div>
        </div>
      </div>
    </div>
  `;

  document.getElementById("back-link").addEventListener("click", (e) => {
    e.preventDefault();
    history.length > 1 ? history.back() : (location.href = "/communities.html");
  });

  content.querySelectorAll("[data-clear-slot]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        await api.del(`/api/community-slots/${btn.dataset.clearSlot}`);
        await load();
      } catch (err) {
        alert(err.message);
      }
    });
  });

  const toggleGameStatusBtn = document.getElementById("toggle-game-status-btn");
  if (toggleGameStatusBtn) {
    toggleGameStatusBtn.addEventListener("click", async () => {
      toggleGameStatusBtn.disabled = true;
      try {
        await api.patch(`/api/community-games/${gameId}`, { status: g.status === "open" ? "closed" : "open" });
        await load();
      } catch (err) {
        alert(err.message);
        toggleGameStatusBtn.disabled = false;
      }
    });
  }

  if (!closed) {
    content.querySelectorAll("[data-claim-slot]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.claimingSlotId = btn.dataset.claimSlot;
        state.claimError = "";
        render();
      });
    });
    content.querySelectorAll("[data-cancel-claim]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.claimingSlotId = null;
        render();
      });
    });
    const form = content.querySelector(".slot-claim-form");
    if (form && form.tagName === "FORM") {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const slotId = form.dataset.slot;
        const btn = form.querySelector("button[type='submit']");
        btn.disabled = true;
        try {
          await api.post(`/api/community-games/${gameId}/slots/${slotId}/claim`, {});
          state.claimingSlotId = null;
          state.claimError = "";
          await load();
        } catch (err) {
          state.claimingSlotId = null;
          state.claimError = err.message;
          render();
        }
      });
    }
  }
}

init();
