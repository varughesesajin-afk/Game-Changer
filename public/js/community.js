const params = new URLSearchParams(location.search);
const communityId = params.get("id");
const content = document.getElementById("content");

let state = { community: null, members: [], games: [], me: null, joined: false, isAdmin: false, showEdit: false, showAddGame: false };

async function init() {
  if (!communityId) {
    content.innerHTML = `<div class="alert error">No community specified.</div>`;
    return;
  }
  const loginError = readLoginError();
  try {
    await load();
    if (loginError) {
      content.insertAdjacentHTML("afterbegin", `<div class="alert error">${escapeHtml(loginError)}</div>`);
    }
  } catch (e) {
    content.innerHTML = `<div class="alert error">Couldn't load this community: ${escapeHtml(e.message)}</div>`;
  }
}

async function load() {
  const [community, members, games, me, isAdmin] = await Promise.all([
    api.get(`/api/communities/${communityId}`),
    api.get(`/api/communities/${communityId}/members`),
    api.get(`/api/communities/${communityId}/games`),
    whoAmI(true),
    checkIsAdmin(),
  ]);
  state.community = community;
  state.members = members;
  state.games = games;
  state.me = me.user;
  state.isAdmin = isAdmin;
  state.joined = false;
  if (me.user) {
    try {
      const mine = await api.get("/api/me/communities");
      state.joined = mine.some((c) => c.id === communityId);
    } catch (e) {
      // not fatal — join button will just show again
    }
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

function canManage() {
  const c = state.community;
  return !!(c && (state.isAdmin || (state.me && c.hostUserId === state.me.id)));
}

function gameCard(g) {
  const full = g.filledSlots >= g.totalSlots;
  const closed = g.status !== "open";
  const badgeClass = closed ? "" : full ? "warning" : "accent";
  const badgeLabel = closed ? (g.status === "completed" ? "Completed" : "Closed") : full ? "Full" : "Open";
  return `
    <div class="event-card" style="position:relative;">
      <a href="/community-game.html?id=${encodeURIComponent(g.id)}" style="display:block;">
        <span class="badge ${badgeClass}">${badgeLabel}</span>
        <h3>${escapeHtml(g.title || g.sportLabel || "Game")}</h3>
        ${g.venue ? `<div class="muted small">📍 ${escapeHtml(g.venue)}</div>` : ""}
        <div class="small muted">📅 ${escapeHtml(fmtDateOnly(g.date))}${g.time ? " · " + escapeHtml(fmtTime(g.time)) : ""}</div>
        <div class="small muted">${g.filledSlots}/${g.totalSlots} players · ${g.entryFee ? "AED " + g.entryFee : "Free"}</div>
      </a>
      ${canManage() ? `<button class="btn small danger" type="button" data-delete-game="${g.id}" style="margin-top:10px;">Delete game</button>` : ""}
    </div>
  `;
}

function renderManagePanel() {
  const c = state.community;
  const closed = c.status !== "open";
  return `
    <div class="card" style="margin-top:18px; border-color: var(--accent);">
      <div class="flex-between">
        <h3 style="margin:0;">⚙️ You manage this community</h3>
        <div style="display:flex; gap:6px;">
          <button class="btn small secondary" type="button" id="toggle-edit-btn">${state.showEdit ? "Cancel" : "Edit details"}</button>
          <button class="btn small secondary" type="button" id="toggle-status-btn">${closed ? "Reopen" : "Close to new members"}</button>
        </div>
      </div>
      ${
        state.showEdit
          ? `
        <form id="edit-community-form" style="margin-top:14px;">
          <div class="field"><label>Name</label><input id="ec-name" value="${escapeHtml(c.name)}" maxlength="100" required></div>
          <div class="row">
            <div class="field"><label>Venue</label><input id="ec-venue" value="${escapeHtml(c.venue || "")}" maxlength="120"></div>
            <div class="field"><label>Price per game</label><input id="ec-price" type="number" min="0" step="1" value="${c.pricePerGame != null ? c.pricePerGame : ""}"></div>
          </div>
          <div class="field"><label>Usual schedule</label><input id="ec-schedule" value="${escapeHtml(c.scheduleText || "")}" maxlength="60"></div>
          <div class="field"><label>Description</label><textarea id="ec-description" rows="3" maxlength="500">${escapeHtml(c.description || "")}</textarea></div>
          <div id="edit-community-alert"></div>
          <button class="btn" type="submit">Save changes</button>
        </form>`
          : ""
      }
      <div class="flex-between" style="margin-top:14px;">
        <button class="btn small secondary" type="button" id="toggle-addgame-btn">${state.showAddGame ? "Cancel" : "+ Add a game"}</button>
      </div>
      ${
        state.showAddGame
          ? `
        <form id="add-game-form" style="margin-top:14px;">
          <div class="field"><label>Title</label><input id="ag-title" maxlength="100" placeholder="e.g. Friday night 5-a-side"></div>
          <div class="row">
            <div class="field"><label>Players per team</label><input id="ag-teamsize" type="number" min="1" max="11" value="5" required></div>
            <div class="field"><label>Entry fee</label><input id="ag-fee" type="number" min="0" step="1" placeholder="0"></div>
          </div>
          <div class="row">
            <div class="field"><label>Date</label><input id="ag-date" type="date" required></div>
            <div class="field"><label>Time</label><input id="ag-time" type="time"></div>
          </div>
          <div class="field"><label>Venue</label><input id="ag-venue" maxlength="120" placeholder="Optional"></div>
          <div id="add-game-alert"></div>
          <button class="btn" type="submit">Create game</button>
        </form>`
          : ""
      }
    </div>
  `;
}

function render() {
  const c = state.community;
  const closed = c.status !== "open";

  let joinArea;
  if (state.joined) {
    joinArea = `<div class="badge accent">✓ You're a member</div>`;
  } else if (closed) {
    joinArea = `<div class="muted small">This community isn't open to new members right now.</div>`;
  } else if (!state.me) {
    joinArea = `
      <div class="card" style="max-width:360px;">
        <p class="small muted" style="margin-top:0;">Sign in with Google to join this community.</p>
        ${signInButtonHtml("Continue with Google to join")}
      </div>`;
  } else {
    joinArea = `<button class="btn" id="join-btn">Join as ${escapeHtml(state.me.name)}</button>`;
  }

  content.innerHTML = `
    <a href="/communities.html" class="small">← All communities</a>

    <div class="event-hero">
      <div class="event-hero-top">
        <div>
          <span class="badge">${closed ? "Closed" : "Open"}</span>
          <h1>${escapeHtml(c.name)}</h1>
          <div class="muted">${escapeHtml(c.sportLabel || "")}${c.host ? " · Host " + escapeHtml(c.host) : ""}</div>
        </div>
      </div>
      <div class="event-hero-chips">
        ${c.venue ? `<div class="event-hero-chip"><span class="ehc-icon">📍</span><div><label>Venue</label><div class="ehc-val">${escapeHtml(c.venue)}</div></div></div>` : ""}
        <div class="event-hero-chip"><span class="ehc-icon">👥</span><div><label>Members</label><div class="ehc-val">${c.memberCount}</div></div></div>
        <div class="event-hero-chip"><span class="ehc-icon">🗓️</span><div><label>Upcoming</label><div class="ehc-val">${c.upcomingGamesCount} game${c.upcomingGamesCount === 1 ? "" : "s"}</div></div></div>
      </div>
    </div>

    ${state.isAdmin ? manageLinkHtml(`#community=${communityId}`, "Site admin dashboard") : ""}
    ${c.scheduleText ? `<div class="small muted" style="margin-top:6px;">🗓️ ${escapeHtml(c.scheduleText)}</div>` : ""}
    ${c.pricePerGame ? `<div class="small muted">💰 AED ${escapeHtml(String(c.pricePerGame))} / game</div>` : ""}
    ${c.description ? `<p style="margin-top:14px;">${escapeHtml(c.description)}</p>` : ""}

    <div class="flex-between" style="margin-top:18px;">${joinArea}</div>
    <div id="join-alert"></div>

    ${canManage() ? renderManagePanel() : ""}

    <h2>Members (${state.members.length})</h2>
    ${
      state.members.length
        ? `<div class="card"><div class="member-avatars">${state.members
            .slice(0, 24)
            .map((m) => `<div class="member-avatar" title="${escapeHtml(m.name)}">${escapeHtml(initials(m.name))}</div>`)
            .join("")}</div></div>`
        : `<div class="empty-state">No members yet — be the first to join!</div>`
    }

    <div class="section-head"><h2>Upcoming games</h2></div>
    ${state.games.length ? `<div class="grid">${state.games.map(gameCard).join("")}</div>` : `<div class="empty-state">No games scheduled yet.</div>`}
  `;

  const joinBtn = document.getElementById("join-btn");
  if (joinBtn) {
    joinBtn.addEventListener("click", async () => {
      joinBtn.disabled = true;
      try {
        await api.post(`/api/communities/${communityId}/join`, {});
        await load();
      } catch (err) {
        joinBtn.disabled = false;
        content.querySelector("#join-alert").innerHTML = `<div class="alert error">${escapeHtml(err.message)}</div>`;
      }
    });
  }

  content.querySelectorAll("[data-delete-game]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this game? This can't be undone.")) return;
      try {
        await api.del(`/api/community-games/${btn.dataset.deleteGame}`);
        await load();
      } catch (err) {
        alert(err.message);
      }
    });
  });

  const toggleEditBtn = document.getElementById("toggle-edit-btn");
  if (toggleEditBtn) {
    toggleEditBtn.addEventListener("click", () => {
      state.showEdit = !state.showEdit;
      render();
    });
  }

  const toggleStatusBtn = document.getElementById("toggle-status-btn");
  if (toggleStatusBtn) {
    toggleStatusBtn.addEventListener("click", async () => {
      toggleStatusBtn.disabled = true;
      try {
        await api.patch(`/api/communities/${communityId}`, { status: c.status === "open" ? "closed" : "open" });
        await load();
      } catch (err) {
        alert(err.message);
        toggleStatusBtn.disabled = false;
      }
    });
  }

  const editForm = document.getElementById("edit-community-form");
  if (editForm) {
    editForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const alertEl = document.getElementById("edit-community-alert");
      try {
        await api.patch(`/api/communities/${communityId}`, {
          name: document.getElementById("ec-name").value.trim(),
          venue: document.getElementById("ec-venue").value.trim(),
          pricePerGame: document.getElementById("ec-price").value,
          scheduleText: document.getElementById("ec-schedule").value.trim(),
          description: document.getElementById("ec-description").value.trim(),
        });
        state.showEdit = false;
        await load();
      } catch (err) {
        alertEl.innerHTML = `<div class="alert error">${escapeHtml(err.message)}</div>`;
      }
    });
  }

  const toggleAddGameBtn = document.getElementById("toggle-addgame-btn");
  if (toggleAddGameBtn) {
    toggleAddGameBtn.addEventListener("click", () => {
      state.showAddGame = !state.showAddGame;
      render();
    });
  }

  const addGameForm = document.getElementById("add-game-form");
  if (addGameForm) {
    addGameForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const alertEl = document.getElementById("add-game-alert");
      try {
        await api.post(`/api/communities/${communityId}/games`, {
          sport: c.sport,
          title: document.getElementById("ag-title").value.trim(),
          teamSize: document.getElementById("ag-teamsize").value,
          entryFee: document.getElementById("ag-fee").value,
          date: document.getElementById("ag-date").value,
          time: document.getElementById("ag-time").value,
          venue: document.getElementById("ag-venue").value.trim(),
        });
        state.showAddGame = false;
        await load();
      } catch (err) {
        alertEl.innerHTML = `<div class="alert error">${escapeHtml(err.message)}</div>`;
      }
    });
  }
}

init();
