const content = document.getElementById("content");
const logoutLink = document.getElementById("logout-link");

let admin = { isAdmin: false };
let dashState = {
  events: [],
  matchdays: [],
  communities: [],
  section: "events",
  showCreateForm: false,
  showCreateMatchdayForm: false,
  showCreateCommunityForm: false,
};
let eventState = null;
let matchdayState = null;
let communityState = null;
let penaltyExtraRounds = {}; // matchId -> extra sudden-death rounds added beyond the base 5
let goalEventExtraRows = {}; // matchId -> extra blank goal-entry rows added beyond the default

window.addEventListener("hashchange", route);
logoutLink.addEventListener("click", async (e) => {
  e.preventDefault();
  await api.post("/api/admin/logout");
  admin.isAdmin = false;
  location.hash = "";
  route();
});

async function boot() {
  try {
    admin = await api.get("/api/admin/session");
  } catch (e) {
    admin = { isAdmin: false };
  }
  route();
}

function route() {
  logoutLink.style.display = admin.isAdmin ? "inline" : "none";
  if (!admin.isAdmin) return renderLogin();
  const hash = location.hash.replace(/^#/, "");
  const params = new URLSearchParams(hash);
  const eventId = params.get("event");
  const matchdayId = params.get("matchday");
  const communityId = params.get("community");
  if (eventId) return renderEventView(eventId);
  if (matchdayId) return renderMatchdayView(matchdayId);
  if (communityId) return renderCommunityView(communityId);
  return renderDashboard();
}

function renderLogin() {
  content.innerHTML = `
    <div class="card" style="max-width:380px; margin:60px auto;">
      <h2 style="margin-top:0;">Organizer login</h2>
      <div id="login-alert"></div>
      <form id="login-form">
        <div class="field">
          <label>Password</label>
          <input type="password" name="password" required autofocus>
        </div>
        <button class="btn" type="submit" style="width:100%;">Log in</button>
      </form>
    </div>
  `;
  document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const password = new FormData(e.target).get("password");
    try {
      await api.post("/api/admin/login", { password });
      admin.isAdmin = true;
      route();
    } catch (err) {
      document.getElementById("login-alert").innerHTML = `<div class="alert error">${escapeHtml(err.message)}</div>`;
    }
  });
}

async function renderDashboard() {
  content.innerHTML = `<div class="empty-state"><span class="spinner"></span></div>`;
  try {
    const [events, matchdays, communities] = await Promise.all([
      api.get("/api/admin/events"),
      api.get("/api/admin/matchdays"),
      api.get("/api/admin/communities"),
    ]);
    dashState.events = events;
    dashState.matchdays = matchdays;
    dashState.communities = communities;
  } catch (e) {
    content.innerHTML = `<div class="alert error">${escapeHtml(e.message)}</div>`;
    return;
  }
  drawDashboard();
}

const DASH_SECTIONS = {
  events: { label: "Events", noun: "events", newLabel: "+ New event", formHtml: createEventFormHtml, wire: wireCreateEventForm, row: (x) => dashboardEventRow(x), empty: "No events yet. Create your first one above.", showKey: "showCreateForm", openKey: "openEvent", hashKey: "event" },
  matchdays: { label: "Match Days", noun: "match days", newLabel: "+ New match day", formHtml: createMatchdayFormHtml, wire: wireCreateMatchdayForm, row: (x) => dashboardMatchdayRow(x), empty: "No match days yet. Create your first one above.", showKey: "showCreateMatchdayForm", openKey: "openMatchday", hashKey: "matchday" },
  communities: { label: "Communities", noun: "communities", newLabel: "+ New community", formHtml: createCommunityFormHtml, wire: wireCreateCommunityForm, row: (x) => dashboardCommunityRow(x), empty: "No communities yet. Create your first one above.", showKey: "showCreateCommunityForm", openKey: "openCommunity", hashKey: "community" },
};

function drawDashboard() {
  const { section } = dashState;
  const cfg = DASH_SECTIONS[section];
  const list = dashState[section];
  const showingCreate = dashState[cfg.showKey];

  content.innerHTML = `
    <div class="page-hero">
      <div class="flex-between">
        <h1 style="margin:0;">Your ${cfg.noun}</h1>
        <button class="btn" id="new-item-btn">${showingCreate ? "Cancel" : cfg.newLabel}</button>
      </div>
    </div>

    <div class="tabs" style="margin-top:18px;">
      ${Object.entries(DASH_SECTIONS)
        .map(([key, c]) => `<div class="tab ${section === key ? "active" : ""}" data-dash-section="${key}">${c.label}</div>`)
        .join("")}
    </div>

    ${showingCreate ? `<div class="card" style="margin-top:16px;">${cfg.formHtml()}</div>` : ""}

    <div class="stack" style="margin-top:20px;">
      ${list.length ? list.map(cfg.row).join("") : `<div class="empty-state">${cfg.empty}</div>`}
    </div>
  `;

  content.querySelectorAll("[data-dash-section]").forEach((t) => {
    t.addEventListener("click", () => {
      dashState.section = t.dataset.dashSection;
      drawDashboard();
    });
  });

  document.getElementById("new-item-btn").addEventListener("click", () => {
    dashState[cfg.showKey] = !dashState[cfg.showKey];
    drawDashboard();
  });

  if (showingCreate) cfg.wire();

  content.querySelectorAll("[data-open-event]").forEach((el) => {
    el.addEventListener("click", () => {
      location.hash = `event=${el.dataset.openEvent}`;
    });
  });
  content.querySelectorAll("[data-open-matchday]").forEach((el) => {
    el.addEventListener("click", () => {
      location.hash = `matchday=${el.dataset.openMatchday}`;
    });
  });
  content.querySelectorAll("[data-open-community]").forEach((el) => {
    el.addEventListener("click", () => {
      location.hash = `community=${el.dataset.openCommunity}`;
    });
  });
}

function matchdayStatusBadge(md) {
  const full = md.signupCount >= md.maxPlayers;
  if (md.status !== "open") return { cls: "", label: "Closed" };
  if (full) return { cls: "warning", label: "Full" };
  return { cls: "accent", label: "Open" };
}

function dashboardMatchdayRow(md) {
  const badge = matchdayStatusBadge(md);
  return `
    <div class="card" style="cursor:pointer;" data-open-matchday="${md.id}">
      <div class="flex-between">
        <div>
          <span class="badge ${badge.cls}">${badge.label}</span>
          <h3 style="margin:8px 0 4px;">${escapeHtml(md.name || "Match Day")}</h3>
          <div class="small muted">
            ${md.venue ? escapeHtml(md.venue) + " · " : ""}${escapeHtml(fmtDateOnly(md.date))}${md.time ? " · " + escapeHtml(md.time) : ""}
            · ${md.signupCount}/${md.maxPlayers} players
          </div>
        </div>
        <div class="small muted">Manage →</div>
      </div>
    </div>
  `;
}

function createMatchdayFormHtml() {
  return `
    <h3 style="margin-top:0;">Create a new match day</h3>
    <div id="create-matchday-alert"></div>
    <form id="create-matchday-form">
      <div class="field">
        <label>Name (optional)</label>
        <input name="name" maxlength="100" placeholder="e.g. Sunday 6-a-side">
      </div>
      <div class="row">
        <div class="field">
          <label>Venue</label>
          <input name="venue" maxlength="120" placeholder="e.g. Riverside Fields">
        </div>
        <div class="field">
          <label>Date</label>
          <input name="date" type="date" required>
        </div>
        <div class="field">
          <label>Time (optional)</label>
          <input name="time" type="time">
        </div>
      </div>
      <div class="field">
        <label>Max players</label>
        <div class="row" style="align-items:center; gap:8px;">
          <button type="button" class="btn secondary small" data-max-preset="12">12</button>
          <button type="button" class="btn secondary small" data-max-preset="16">16</button>
          <button type="button" class="btn secondary small" data-max-preset="18">18</button>
          <input name="maxPlayers" type="number" min="2" max="200" value="16" style="max-width:100px;" required>
        </div>
        <div class="hint">Pick a quick preset or type any number.</div>
      </div>
      <div class="field">
        <label>Notes (optional)</label>
        <textarea name="notes" rows="2" placeholder="e.g. Bring your own ball, OMR 2 per person"></textarea>
      </div>
      <button class="btn" type="submit">Create match day</button>
    </form>
  `;
}

function wireCreateMatchdayForm() {
  const form = document.getElementById("create-matchday-form");
  form.querySelectorAll("[data-max-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      form.querySelector('[name="maxPlayers"]').value = btn.dataset.maxPreset;
    });
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    try {
      const md = await api.post("/api/admin/matchdays", payload);
      dashState.showCreateMatchdayForm = false;
      location.hash = `matchday=${md.id}`;
    } catch (err) {
      document.getElementById("create-matchday-alert").innerHTML = `<div class="alert error">${escapeHtml(err.message)}</div>`;
    }
  });
}

function dashboardEventRow(ev) {
  const sportLabel = SPORTS_CACHE.find((s) => s.key === ev.sport)?.label || ev.sport;
  return `
    <div class="card" style="cursor:pointer;" data-open-event="${ev.id}">
      <div class="flex-between">
        <div>
          <span class="badge ${statusBadgeClass(ev.status)}">${escapeHtml(STATUS_LABELS[ev.status] || ev.status)}</span>
          <h3 style="margin:8px 0 4px;">${escapeHtml(ev.name)}</h3>
          <div class="small muted">${escapeHtml(sportLabel)} · ${ev.registrationCount} registered ${ev.format ? "· format: " + escapeHtml(formatLabel(ev.format)) : ""}</div>
        </div>
        <div class="small muted">Manage →</div>
      </div>
    </div>
  `;
}

function createEventFormHtml() {
  const sportOptions = SPORTS_CACHE.map((s) => `<option value="${s.key}">${escapeHtml(s.label)}</option>`).join("");
  return `
    <h3 style="margin-top:0;">Create a new event</h3>
    <div id="create-alert"></div>
    <form id="create-form">
      <div class="row">
        <div class="field" style="flex:2;">
          <label>Event name</label>
          <input name="name" required maxlength="100" placeholder="e.g. Summer Football Cup 2026">
        </div>
        <div class="field">
          <label>Sport</label>
          <select name="sport" required>${sportOptions}</select>
        </div>
      </div>
      <div class="field">
        <label>Description (optional)</label>
        <textarea name="description" rows="2"></textarea>
      </div>
      <div class="row">
        <div class="field">
          <label>Venue (optional)</label>
          <input name="venue" maxlength="120">
        </div>
        <div class="field">
          <label>Start date (optional)</label>
          <input name="startDate" type="date">
        </div>
        <div class="field">
          <label>Registration deadline (optional)</label>
          <input name="regDeadline" type="date">
        </div>
      </div>
      <button class="btn" type="submit">Create event</button>
    </form>
  `;
}

function wireCreateEventForm() {
  document.getElementById("create-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = Object.fromEntries(fd.entries());
    try {
      const ev = await api.post("/api/admin/events", payload);
      dashState.showCreateForm = false;
      location.hash = `event=${ev.id}`;
    } catch (err) {
      document.getElementById("create-alert").innerHTML = `<div class="alert error">${escapeHtml(err.message)}</div>`;
    }
  });
}

async function renderEventView(id) {
  content.innerHTML = `<div class="empty-state"><span class="spinner"></span></div>`;
  try {
    const [event, registrations, matches, suggestion, standings, stats, players] = await Promise.all([
      api.get(`/api/admin/events/${id}`),
      api.get(`/api/admin/events/${id}/registrations`),
      api.get(`/api/admin/events/${id}/matches`),
      api.get(`/api/admin/events/${id}/suggest-format`),
      api.get(`/api/admin/events/${id}/standings`),
      api.get(`/api/admin/events/${id}/stats`),
      api.get(`/api/admin/events/${id}/players`),
    ]);
    eventState = { id, event, registrations, matches, suggestion, standings, stats, players, activeTab: eventState && eventState.id === id ? eventState.activeTab : "settings", selectedFormat: null };
  } catch (e) {
    content.innerHTML = `<div class="alert error">${escapeHtml(e.message)}</div><p><a href="#">← Back</a></p>`;
    return;
  }
  drawEventView();
}

async function reloadEventState() {
  const id = eventState.id;
  const [event, registrations, matches, suggestion, standings, stats, players] = await Promise.all([
    api.get(`/api/admin/events/${id}`),
    api.get(`/api/admin/events/${id}/registrations`),
    api.get(`/api/admin/events/${id}/matches`),
    api.get(`/api/admin/events/${id}/suggest-format`),
    api.get(`/api/admin/events/${id}/standings`),
    api.get(`/api/admin/events/${id}/stats`),
    api.get(`/api/admin/events/${id}/players`),
  ]);
  Object.assign(eventState, { event, registrations, matches, suggestion, standings, stats, players });
}

function drawEventView() {
  const { event, activeTab } = eventState;
  const sport = SPORTS_CACHE.find((s) => s.key === event.sport);
  const isTeam = (sport ? sport.category : event.category) !== "individual";
  const tabs = [
    ["settings", "Settings"],
    ["registrations", `Registrations (${eventState.registrations.length})`],
    ["fixtures", "Fixture format"],
    ["scores", "Scores & Schedule"],
    ["standings", "Standings"],
  ];
  if (isTeam) tabs.push(["stats", "Top Scorers"]);
  tabs.push(["players", "Player Ratings"]);

  content.innerHTML = `
    <a href="#" class="small">← All events</a>

    <div class="event-hero">
      <div class="event-hero-top">
        <div>
          <span class="badge">${escapeHtml(STATUS_LABELS[event.status] || event.status)}</span>
          <h1>${escapeHtml(event.name)}</h1>
          <div class="muted">${sport ? escapeHtml(sport.label) : escapeHtml(event.sport)}</div>
        </div>
        <a class="small" style="color:#fff;" href="/event.html?id=${event.id}" target="_blank">View public page ↗</a>
      </div>
      <div class="event-hero-chips">
        ${event.venue ? `<div class="event-hero-chip"><span class="ehc-icon">📍</span><div><label>Venue</label><div class="ehc-val">${escapeHtml(event.venue)}</div></div></div>` : ""}
        ${event.startDate ? `<div class="event-hero-chip"><span class="ehc-icon">📅</span><div><label>Start date</label><div class="ehc-val">${escapeHtml(fmtDateOnly(event.startDate))}</div></div></div>` : ""}
        <div class="event-hero-chip"><span class="ehc-icon">👥</span><div><label>Entrants</label><div class="ehc-val">${eventState.registrations.length}</div></div></div>
      </div>
    </div>

    <div class="tabs" style="margin-top:20px;">
      ${tabs.map(([id, label]) => `<div class="tab ${activeTab === id ? "active" : ""}" data-tab="${id}">${label}</div>`).join("")}
    </div>
    <div id="event-tab-body"></div>
  `;

  content.querySelectorAll(".tab").forEach((t) => {
    t.addEventListener("click", () => {
      eventState.activeTab = t.dataset.tab;
      drawEventView();
    });
  });

  const body = document.getElementById("event-tab-body");
  if (activeTab === "settings") drawSettingsTab(body);
  if (activeTab === "registrations") drawRegistrationsTab(body);
  if (activeTab === "fixtures") drawFixturesTab(body);
  if (activeTab === "scores") drawScoresTab(body);
  if (activeTab === "standings") drawStandingsTab(body);
  if (activeTab === "stats") drawStatsTab(body);
  if (activeTab === "players") drawPlayersTab(body);
}

function playerCard(p, isIndividual) {
  const statsHtml = isIndividual
    ? `
      <div><span>${p.wins}</span><label>Wins</label></div>
      <div><span>${p.draws}</span><label>Draws</label></div>
      <div><span>${p.losses}</span><label>Losses</label></div>`
    : `
      <div><span>${p.goals}</span><label>Goals</label></div>
      <div><span>${p.assists}</span><label>Assists</label></div>
      <div><span>${p.potm}</span><label>POTM</label></div>`;
  return `
    <div class="player-card">
      <div class="player-card-top">
        <div class="player-ovr">${p.ovr}</div>
        <div>
          <div class="player-name">${escapeHtml(p.name)}</div>
          ${p.team ? `<div class="small muted">${escapeHtml(p.team)}</div>` : ""}
        </div>
      </div>
      <div class="player-stats">${statsHtml}</div>
    </div>
  `;
}

function drawPlayersTab(body) {
  const players = eventState.players || [];
  const isIndividual = eventState.event.category === "individual" || SPORTS_CACHE.find((s) => s.key === eventState.event.sport)?.category === "individual";
  if (!players.length) {
    body.innerHTML = `<div class="empty-state">No player stats yet${isIndividual ? "" : " — list rosters when adding registrations, or log goals/assists/POTM once matches are played"}.</div>`;
    return;
  }
  body.innerHTML = `
    <div class="hint" style="margin-bottom:12px;">OVR is a quick, transparent rating from this event's results${isIndividual ? " (wins/draws/losses)" : " (goals, assists, and Player of the Match tags)"} — not an official ranking.</div>
    <div class="grid">${players.map((p) => playerCard(p, isIndividual)).join("")}</div>
  `;
}

function leaderTable(rows, nameLabel, valueLabel, valueKey) {
  if (!rows.length) return `<div class="empty-state">Nothing recorded yet.</div>`;
  return `
    <table>
      <thead><tr><th>#</th><th>${nameLabel}</th><th>${valueLabel}</th></tr></thead>
      <tbody>
        ${rows
          .map(
            (r, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${escapeHtml(r.name)}</td>
            <td><strong>${r[valueKey]}</strong></td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function drawStatsTab(body) {
  const s = eventState.stats || { topScorers: [], topAssists: [], bestDefense: [] };
  body.innerHTML = `
    <h3 style="margin-top:0;">Top Scorers</h3>
    <div class="card">${leaderTable(s.topScorers, "Player", "Goals", "goals")}</div>

    <h3>Most Assists</h3>
    <div class="card">${leaderTable(s.topAssists, "Player", "Assists", "assists")}</div>

    <h3>Player of the Match</h3>
    <div class="card">${leaderTable(s.potmLeaders || [], "Player", "POTM", "potm")}</div>

    <h3>Best Defense</h3>
    <div class="card">
      ${
        s.bestDefense.length
          ? `<table>
          <thead><tr><th>#</th><th>Team</th><th>P</th><th>Clean sheets</th><th>Conceded</th></tr></thead>
          <tbody>
            ${s.bestDefense
              .map(
                (r, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${escapeHtml(r.name)}</td>
                <td>${r.played}</td>
                <td><strong>${r.cleanSheets}</strong></td>
                <td>${r.conceded}</td>
              </tr>`
              )
              .join("")}
          </tbody>
        </table>`
          : `<div class="empty-state">Nothing recorded yet.</div>`
      }
    </div>
  `;
}

function adminStandingsTable(rows, isIndividual) {
  return `
    <table>
      <thead><tr><th>#</th><th>${isIndividual ? "Player" : "Team"}</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr></thead>
      <tbody>
        ${rows
          .map(
            (r, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${escapeHtml(r.name)}</td>
            <td>${r.played}</td>
            <td>${r.wins}</td>
            <td>${r.draws}</td>
            <td>${r.losses}</td>
            <td>${r.goalDiff > 0 ? "+" : ""}${r.goalDiff}</td>
            <td><strong>${r.points}</strong></td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function drawStandingsTab(body) {
  const s = eventState.standings;
  const isIndividual = eventState.event.category === "individual" || SPORTS_CACHE.find((sp) => sp.key === eventState.event.sport)?.category === "individual";
  let html = "";
  if (s && s.overall && s.overall.length) {
    html += `<div class="card">${adminStandingsTable(s.overall, isIndividual)}</div>`;
  }
  if (s && s.groups && s.groups.length) {
    s.groups.forEach((g) => {
      html += `<h3>${escapeHtml(g.name)}</h3><div class="card">${adminStandingsTable(g.standings, isIndividual)}</div>`;
    });
  }
  if (!html) {
    html = `<div class="empty-state">No standings yet — this format doesn't produce a league table, or no matches have been completed.</div>`;
  }
  body.innerHTML = html;
}

function drawSettingsTab(body) {
  const e = eventState.event;
  body.innerHTML = `
    <div class="card">
      <div id="settings-alert"></div>
      <form id="settings-form">
        <div class="field">
          <label>Event name</label>
          <input name="name" value="${escapeHtml(e.name)}" required maxlength="100">
        </div>
        <div class="field">
          <label>Description</label>
          <textarea name="description" rows="2">${escapeHtml(e.description || "")}</textarea>
        </div>
        <div class="row">
          <div class="field">
            <label>Venue</label>
            <input name="venue" value="${escapeHtml(e.venue || "")}" maxlength="120">
          </div>
          <div class="field">
            <label>Start date</label>
            <input name="startDate" type="date" value="${e.startDate || ""}">
          </div>
          <div class="field">
            <label>Registration deadline</label>
            <input name="regDeadline" type="date" value="${e.regDeadline || ""}">
          </div>
        </div>
        <div class="field">
          <label>Status</label>
          <select name="status">
            ${["draft", "registration_open", "registration_closed", "fixtures_set", "in_progress", "completed"]
              .map((s) => `<option value="${s}" ${e.status === s ? "selected" : ""}>${STATUS_LABELS[s]}</option>`)
              .join("")}
          </select>
          <div class="hint">Only events with a status other than "Draft" are visible on the public site.</div>
        </div>
        <button class="btn" type="submit">Save changes</button>
      </form>
    </div>

    <div class="card" style="margin-top:14px; border-color: var(--danger);">
      <h3 style="margin-top:0; color:var(--danger);">Danger zone</h3>
      <p class="small muted">Deleting an event permanently removes its registrations and fixtures.</p>
      <button class="btn danger" id="delete-event-btn">Delete this event</button>
    </div>
  `;

  document.getElementById("settings-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const payload = Object.fromEntries(new FormData(ev.target).entries());
    try {
      await api.patch(`/api/admin/events/${eventState.id}`, payload);
      await reloadEventState();
      drawEventView();
    } catch (err) {
      document.getElementById("settings-alert").innerHTML = `<div class="alert error">${escapeHtml(err.message)}</div>`;
    }
  });

  document.getElementById("delete-event-btn").addEventListener("click", async () => {
    if (!confirm(`Delete "${e.name}"? This cannot be undone.`)) return;
    await api.del(`/api/admin/events/${eventState.id}`);
    location.hash = "";
    renderDashboard();
  });
}

function drawRegistrationsTab(body) {
  const regs = eventState.registrations;
  const isIndividual = eventState.event.category === "individual" || SPORTS_CACHE.find((s) => s.key === eventState.event.sport)?.category === "individual";
  body.innerHTML = `
    <div class="card">
      <table>
        <thead><tr><th>${isIndividual ? "Player" : "Team"}</th><th>Members</th><th>Contact</th><th></th></tr></thead>
        <tbody>
          ${
            regs.length
              ? regs
                  .map(
                    (r) => `
            <tr>
              <td>${escapeHtml(r.name)}</td>
              <td class="small">${(r.members || []).map(escapeHtml).join(", ")}</td>
              <td class="small">${escapeHtml(r.contactName || "")}${r.contactEmail ? "<br>" + escapeHtml(r.contactEmail) : ""}${r.contactPhone ? "<br>" + escapeHtml(r.contactPhone) : ""}</td>
              <td><button class="btn secondary small" data-remove-reg="${r.id}">Remove</button></td>
            </tr>`
                  )
                  .join("")
              : `<tr><td colspan="4" class="muted">No registrations yet.</td></tr>`
          }
        </tbody>
      </table>
    </div>

    <div class="card" style="margin-top:14px;">
      <h3 style="margin-top:0;">Add an entry manually</h3>
      <div id="manual-reg-alert"></div>
      <form id="manual-reg-form">
        <div class="row">
          <div class="field">
            <label>${isIndividual ? "Player name" : "Team name"}</label>
            <input name="name" required maxlength="80">
          </div>
          <div class="field">
            <label>Contact name</label>
            <input name="contactName" maxlength="80">
          </div>
          <div class="field">
            <label>Contact email/phone</label>
            <input name="contactEmail" maxlength="120">
          </div>
        </div>
        <button class="btn secondary" type="submit">Add entry</button>
      </form>
    </div>
  `;

  body.querySelectorAll("[data-remove-reg]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Remove this registration?")) return;
      try {
        await api.del(`/api/admin/registrations/${btn.dataset.removeReg}`);
        await reloadEventState();
        drawEventView();
      } catch (err) {
        alert(err.message);
      }
    });
  });

  document.getElementById("manual-reg-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const payload = Object.fromEntries(new FormData(ev.target).entries());
    try {
      await api.post(`/api/admin/events/${eventState.id}/registrations`, payload);
      await reloadEventState();
      drawEventView();
    } catch (err) {
      document.getElementById("manual-reg-alert").innerHTML = `<div class="alert error">${escapeHtml(err.message)}</div>`;
    }
  });
}

function drawFixturesTab(body) {
  const { event, suggestion, matches } = eventState;
  const hasFixtures = matches.length > 0;
  const groupStageDone =
    matches.some((m) => m.stage === "group") &&
    matches.filter((m) => m.stage === "group").every((m) => m.status === "completed");
  const knockoutAlreadyGenerated = matches.some((m) => m.stage === "knockout");

  let html = "";

  if (hasFixtures) {
    html += `
      <div class="alert info">
        Fixtures already generated using <strong>${escapeHtml(formatLabel(event.format))}</strong>
        (${matches.length} matches). Regenerating will replace all current fixtures and scores.
      </div>
    `;
  }

  if (event.format === "group_knockout" && !knockoutAlreadyGenerated) {
    html += `
      <div class="card">
        <h3 style="margin-top:0;">Knockout stage</h3>
        <p class="small muted">${groupStageDone ? "All group matches are complete — generate the knockout bracket from group standings." : "Complete all group-stage matches first, then generate the knockout bracket here."}</p>
        <div class="row" style="align-items:flex-end;">
          <div class="field" style="max-width:160px;">
            <label>Advance per group</label>
            <input type="number" id="advance-count" value="2" min="1" max="4">
          </div>
          <button class="btn" id="gen-knockout-btn" ${groupStageDone ? "" : "disabled"}>Generate knockout stage</button>
        </div>
        <div id="knockout-alert"></div>
      </div>
    `;
  }

  html += `
    <div class="card" style="margin-top:14px;">
      <h3 style="margin-top:0;">${hasFixtures ? "Regenerate fixtures" : "Generate fixtures"}</h3>
  `;

  if (suggestion.primary === null) {
    html += `<p class="muted">${escapeHtml(suggestion.note)}</p></div>`;
  } else {
    const options = [suggestion.primary, ...suggestion.alternatives];
    html += `
      <div class="suggestion-box" style="margin-bottom:16px;">
        <h4>Suggested: ${escapeHtml(suggestion.primary.label)}</h4>
        <p class="small" style="margin:0;">${escapeHtml(suggestion.primary.reason)}</p>
      </div>
      <div id="format-options">
        ${options
          .map(
            (o, i) => `
          <label class="format-option ${i === 0 ? "selected" : ""}" data-format-option>
            <input type="radio" name="format" value="${o.format}" ${i === 0 ? "checked" : ""}>
            <div>
              <div style="font-weight:600;">${escapeHtml(o.label)}${i === 0 ? " (suggested)" : ""}</div>
              <div class="small muted">${escapeHtml(o.reason)}</div>
            </div>
          </label>`
          )
          .join("")}
      </div>
      <div id="generate-alert"></div>
      <button class="btn" id="generate-fixtures-btn" style="margin-top:10px;">${hasFixtures ? "Regenerate fixtures" : "Generate fixtures"}</button>
    </div>`;
  }

  body.innerHTML = html;

  body.querySelectorAll("[data-format-option]").forEach((label) => {
    label.addEventListener("click", () => {
      body.querySelectorAll("[data-format-option]").forEach((l) => l.classList.remove("selected"));
      label.classList.add("selected");
    });
  });

  const genBtn = document.getElementById("generate-fixtures-btn");
  if (genBtn) {
    genBtn.addEventListener("click", async () => {
      const format = body.querySelector('input[name="format"]:checked').value;
      if (hasFixtures && !confirm("This replaces all current fixtures and any scores entered so far. Continue?")) return;
      genBtn.disabled = true;
      try {
        await api.post(`/api/admin/events/${eventState.id}/generate-fixtures`, { format });
        await reloadEventState();
        eventState.activeTab = "scores";
        drawEventView();
      } catch (err) {
        document.getElementById("generate-alert").innerHTML = `<div class="alert error">${escapeHtml(err.message)}</div>`;
        genBtn.disabled = false;
      }
    });
  }

  const knockoutBtn = document.getElementById("gen-knockout-btn");
  if (knockoutBtn) {
    knockoutBtn.addEventListener("click", async () => {
      const advancePerGroup = Number(document.getElementById("advance-count").value) || 2;
      knockoutBtn.disabled = true;
      try {
        await api.post(`/api/admin/events/${eventState.id}/generate-knockout-from-groups`, { advancePerGroup });
        await reloadEventState();
        eventState.activeTab = "scores";
        drawEventView();
      } catch (err) {
        document.getElementById("knockout-alert").innerHTML = `<div class="alert error">${escapeHtml(err.message)}</div>`;
        knockoutBtn.disabled = false;
      }
    });
  }
}

function formatLabel(format) {
  return { round_robin: "Round Robin", knockout: "Single Elimination Knockout", group_knockout: "Groups + Knockout" }[format] || format;
}

function bracketMatchBox(m) {
  const played = m.status === "completed";
  const isBye = m.status === "bye";
  const winnerA = played && m.winnerName && m.winnerName === m.participantAName;
  const winnerB = played && m.winnerName && m.winnerName === m.participantBName;
  const hasPens = m.penalties && m.penalties.shots && m.penalties.shots.length > 0;
  return `
    <div class="bracket-box ${m.roundName === "Final" ? "bracket-final" : ""}">
      <div class="bracket-row ${winnerA ? "winner" : ""}">
        <span>${escapeHtml(m.participantAName || "TBD")}</span>
        <span class="bracket-score">${played ? m.scoreA : ""}</span>
      </div>
      <div class="bracket-row ${winnerB ? "winner" : ""}">
        <span>${escapeHtml(isBye ? "(bye)" : m.participantBName || "TBD")}</span>
        <span class="bracket-score">${played ? m.scoreB : ""}</span>
      </div>
      ${hasPens ? `<div class="bracket-pens">pens ${m.penalties.scoreA}-${m.penalties.scoreB}</div>` : ""}
    </div>
  `;
}

function renderBracket(koMatches) {
  const rounds = [...new Set(koMatches.map((m) => m.round))].sort((a, b) => a - b);
  const byRound = rounds.map((r) =>
    koMatches.filter((m) => m.round === r).sort((a, b) => a.matchNumber - b.matchNumber)
  );
  let html = `<div class="bracket">`;
  byRound.forEach((roundMatches, ri) => {
    const isLast = ri === byRound.length - 1;
    html += `<div class="bracket-round">
      <div class="bracket-round-title">${escapeHtml(roundMatches[0].roundName)}</div>
      <div class="bracket-round-matches ${isLast ? "bracket-round-final" : ""}">`;
    if (isLast) {
      html += roundMatches.map((m) => bracketMatchBox(m)).join("");
    } else {
      for (let i = 0; i < roundMatches.length; i += 2) {
        const pair = roundMatches.slice(i, i + 2);
        html += `<div class="bracket-pair">${pair.map((m) => bracketMatchBox(m)).join("")}</div>`;
      }
    }
    html += `</div></div>`;
  });
  html += `</div>`;
  return html;
}

function drawScoresTab(body) {
  const matches = eventState.matches;
  if (!matches.length) {
    body.innerHTML = `<div class="empty-state">No fixtures yet — generate them from the "Fixture format" tab.</div>`;
    return;
  }

  const sport = SPORTS_CACHE.find((s) => s.key === eventState.event.sport);
  const scoring = sport && sport.scoring && sport.scoring.type === "games" ? sport.scoring : null;
  const category = sport ? sport.category : eventState.event.category || "team";
  const isTeam = category !== "individual";

  const groups = [...new Set(matches.filter((m) => m.groupName).map((m) => m.groupName))];
  const stages = [
    ...groups.map((g) => ({ label: g, list: matches.filter((m) => m.groupName === g) })),
    { label: "Round Robin", list: matches.filter((m) => m.stage === "round_robin") },
    { label: "Knockout", list: matches.filter((m) => m.stage === "knockout") },
  ].filter((s) => s.list.length);

  const knockoutMatches = matches.filter((m) => m.stage === "knockout");
  const bracketHtml = knockoutMatches.length
    ? `<div class="card" style="margin-bottom:16px; overflow-x:auto;"><h3 style="margin-top:0;">Bracket</h3>${renderBracket(knockoutMatches)}</div>`
    : "";

  body.innerHTML = bracketHtml + stages
    .map((stage) => {
      const rounds = [...new Set(stage.list.map((m) => m.round))].sort((a, b) => a - b);
      return `
        <h3>${escapeHtml(stage.label)}</h3>
        ${rounds
          .map((r) => {
            const roundMatches = stage.list.filter((m) => m.round === r);
            const roundName = roundMatches[0].roundName;
            return `<div class="round-heading">${escapeHtml(roundName)}</div>${roundMatches.map((m) => scoreRow(m, scoring, isTeam)).join("")}`;
          })
          .join("")}
      `;
    })
    .join("");

  body.querySelectorAll("[data-save-score]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const row = btn.closest("[data-match-id]");
      const id = row.dataset.matchId;
      if (scoring) {
        const games = [...row.querySelectorAll("[data-game]")].map((gameRow) => [
          gameRow.querySelector('[data-field="gameA"]').value,
          gameRow.querySelector('[data-field="gameB"]').value,
        ]);
        if (!games.some(([a, b]) => a !== "" && b !== "")) return alert("Enter at least one completed game.");
        try {
          await api.patch(`/api/admin/matches/${id}`, { games });
          await reloadEventState();
          drawEventView();
        } catch (err) {
          alert(err.message);
        }
        return;
      }
      const scoreA = row.querySelector('[data-field="scoreA"]').value;
      const scoreB = row.querySelector('[data-field="scoreB"]').value;
      if (scoreA === "" || scoreB === "") return alert("Enter both scores.");
      try {
        await api.patch(`/api/admin/matches/${id}`, { scoreA: Number(scoreA), scoreB: Number(scoreB) });
        await reloadEventState();
        drawEventView();
      } catch (err) {
        alert(err.message);
      }
    });
  });

  body.querySelectorAll("[data-add-pen-round]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.closest("[data-match-id]").dataset.matchId;
      penaltyExtraRounds[id] = (penaltyExtraRounds[id] || 0) + 1;
      drawEventView();
    });
  });

  body.querySelectorAll("[data-save-penalties]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const row = btn.closest("[data-match-id]");
      const id = row.dataset.matchId;
      const shots = [...row.querySelectorAll("[data-pen-shot]")]
        .map((r) => ({
          side: r.dataset.side,
          name: r.querySelector('[data-field="penName"]').value.trim(),
          number: r.querySelector('[data-field="penNumber"]').value,
          result: r.querySelector('[data-field="penResult"]').value,
        }))
        .filter((s) => s.name && s.result)
        .map((s) => ({ side: s.side, name: s.name, number: s.number, scored: s.result === "goal" }));
      if (!shots.length) return alert("Enter at least one kick's name and result (Goal or Miss).");
      try {
        await api.patch(`/api/admin/matches/${id}`, { penalties: shots });
        delete penaltyExtraRounds[id];
        await reloadEventState();
        drawEventView();
      } catch (err) {
        alert(err.message);
      }
    });
  });

  body.querySelectorAll("[data-pen-card]").forEach((card) => {
    card.addEventListener("input", () => computePenLiveState(card));
    card.addEventListener("change", () => computePenLiveState(card));
    computePenLiveState(card);
  });

  body.querySelectorAll("[data-add-goal-row]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.closest("[data-match-id]").dataset.matchId;
      goalEventExtraRows[id] = (goalEventExtraRows[id] || 0) + 1;
      drawEventView();
    });
  });

  body.querySelectorAll("[data-save-goals]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const row = btn.closest("[data-match-id]");
      const id = row.dataset.matchId;
      const goalEvents = [...row.querySelectorAll("[data-goal-row]")]
        .map((r) => ({
          side: r.querySelector('[data-field="goalSide"]').value,
          scorer: r.querySelector('[data-field="goalScorer"]').value,
          assist: r.querySelector('[data-field="goalAssist"]').value,
        }))
        .filter((g) => g.scorer.trim());
      try {
        await api.patch(`/api/admin/matches/${id}`, { goalEvents });
        delete goalEventExtraRows[id];
        await reloadEventState();
        drawEventView();
      } catch (err) {
        alert(err.message);
      }
    });
  });

  body.querySelectorAll("[data-save-potm]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const row = btn.closest("[data-match-id]");
      const id = row.dataset.matchId;
      const side = row.querySelector('[data-field="potmSide"]').value;
      const name = row.querySelector('[data-field="potmName"]').value;
      try {
        await api.patch(`/api/admin/matches/${id}`, { potm: name.trim() ? { side, name } : null });
        await reloadEventState();
        drawEventView();
      } catch (err) {
        alert(err.message);
      }
    });
  });

  body.querySelectorAll("[data-clear-potm]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.closest("[data-match-id]").dataset.matchId;
      try {
        await api.patch(`/api/admin/matches/${id}`, { potm: null });
        await reloadEventState();
        drawEventView();
      } catch (err) {
        alert(err.message);
      }
    });
  });

  body.querySelectorAll("[data-clear-score]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.closest("[data-match-id]").dataset.matchId;
      try {
        await api.del(`/api/admin/matches/${id}/score`);
        await reloadEventState();
        drawEventView();
      } catch (err) {
        alert(err.message);
      }
    });
  });

  body.querySelectorAll("[data-save-schedule]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const row = btn.closest("[data-match-id]");
      const id = row.dataset.matchId;
      const scheduledAt = row.querySelector('[data-field="scheduledAt"]').value;
      const venue = row.querySelector('[data-field="venue"]').value;
      try {
        await api.patch(`/api/admin/matches/${id}`, {
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
          venue,
        });
        await reloadEventState();
        drawEventView();
      } catch (err) {
        alert(err.message);
      }
    });
  });
}

function goalEventsHtml(m, isTeam) {
  if (!isTeam) return "";
  const existing = Array.isArray(m.goalEvents) ? m.goalEvents : [];
  const blankRows = 3 + (goalEventExtraRows[m.id] || 0);
  const rows = [...existing, ...Array.from({ length: blankRows }, () => ({ side: "A", scorer: "", assist: "" }))];
  const nameA = m.participantAName || "Team A";
  const nameB = m.participantBName || "Team B";
  return `
    <div class="card" style="margin-top:10px;">
      <div style="font-weight:600;">Goals & assists</div>
      <div class="hint" style="margin:4px 0 10px;">Optional — log who scored (and who assisted) each goal. Used for the Top Scorers tab.</div>
      ${rows
        .map(
          (g) => `
        <div class="row" data-goal-row style="margin-top:6px; align-items:flex-end;">
          <div class="field" style="max-width:130px;">
            <label class="small">Team</label>
            <select data-field="goalSide">
              <option value="A" ${g.side === "A" ? "selected" : ""}>${escapeHtml(nameA)}</option>
              <option value="B" ${g.side === "B" ? "selected" : ""}>${escapeHtml(nameB)}</option>
            </select>
          </div>
          <div class="field" style="max-width:160px;">
            <label class="small">Scorer</label>
            <input type="text" maxlength="60" data-field="goalScorer" value="${escapeHtml(g.scorer || "")}">
          </div>
          <div class="field" style="max-width:160px;">
            <label class="small">Assist (optional)</label>
            <input type="text" maxlength="60" data-field="goalAssist" value="${escapeHtml(g.assist || "")}">
          </div>
        </div>`
        )
        .join("")}
      <div style="margin-top:10px;">
        <button class="btn small" data-save-goals>Save goals</button>
        <button class="btn secondary small" data-add-goal-row>+ Add row</button>
      </div>
    </div>
  `;
}

function potmHtml(m, isTeam) {
  if (!isTeam) return "";
  const nameA = m.participantAName || "Team A";
  const nameB = m.participantBName || "Team B";
  const current = m.potm || { side: "A", name: "" };
  return `
    <div class="card" style="margin-top:10px;">
      <div style="font-weight:600;">Player of the Match</div>
      <div class="hint" style="margin:4px 0 10px;">Optional — tag the standout player for this match.</div>
      <div class="row" style="align-items:flex-end;">
        <div class="field" style="max-width:130px;">
          <label class="small">Team</label>
          <select data-field="potmSide">
            <option value="A" ${current.side === "A" ? "selected" : ""}>${escapeHtml(nameA)}</option>
            <option value="B" ${current.side === "B" ? "selected" : ""}>${escapeHtml(nameB)}</option>
          </select>
        </div>
        <div class="field" style="max-width:200px;">
          <label class="small">Player name</label>
          <input type="text" maxlength="60" data-field="potmName" value="${escapeHtml(current.name || "")}">
        </div>
        <button class="btn small" data-save-potm>Save POTM</button>
        ${m.potm ? `<button class="btn secondary small" data-clear-potm>Clear</button>` : ""}
      </div>
    </div>
  `;
}

function penaltyShootoutHtml(m) {
  const isDraw = m.stage === "knockout" && m.scoreA != null && m.scoreB != null && m.scoreA === m.scoreB;
  if (!isDraw) return "";
  const existingShots = m.penalties && Array.isArray(m.penalties.shots) ? m.penalties.shots : [];
  const baseRounds = Math.max(5, Math.ceil(existingShots.length / 2));
  const rounds = baseRounds + (penaltyExtraRounds[m.id] || 0);
  const shotFor = (side, round) => {
    // Shots were saved as a flat alternating list (A, B, A, B, ...); find the nth shot for this side.
    const sideShots = existingShots.filter((s) => s.side === side);
    const s = sideShots[round];
    if (!s) return { name: "", number: "", result: "" };
    return { name: s.name || "", number: s.number || "", result: s.scored ? "goal" : "miss" };
  };
  const resultSelect = (shot) => `
    <select data-field="penResult">
      <option value="" ${shot.result === "" ? "selected" : ""}>— not taken —</option>
      <option value="goal" ${shot.result === "goal" ? "selected" : ""}>⚽ Goal</option>
      <option value="miss" ${shot.result === "miss" ? "selected" : ""}>❌ Miss</option>
    </select>`;
  const sideCol = (side, label) => `
    <div style="flex:1; min-width:200px;">
      <div class="small muted" style="margin-bottom:4px;">${escapeHtml(label)}</div>
      ${Array.from({ length: rounds })
        .map((_, i) => {
          const shot = shotFor(side, i);
          return `
        <div class="row" data-pen-shot data-side="${side}" style="margin-top:6px; align-items:flex-end;">
          <div class="field" style="max-width:120px;">
            <label class="small">Kick ${i + 1} — name</label>
            <input type="text" maxlength="60" data-field="penName" value="${escapeHtml(shot.name)}">
          </div>
          <div class="field" style="max-width:70px;">
            <label class="small">#</label>
            <input type="text" maxlength="10" data-field="penNumber" value="${escapeHtml(shot.number)}">
          </div>
          <div class="field" style="max-width:150px;">
            <label class="small">Result</label>
            ${resultSelect(shot)}
          </div>
        </div>`;
        })
        .join("")}
    </div>`;
  return `
    <div class="card" data-pen-card="${m.id}" style="margin-top:10px; background:var(--bg-muted,#f7f7f8);">
      <div style="font-weight:600;">Penalty shootout — scores level, a winner must advance</div>
      <div class="hint" style="margin:4px 0 10px;">Enter each kick's taker and whether it was a goal or a miss. Add sudden-death kicks until one side is ahead with equal kicks taken.</div>
      <div data-pen-live class="pen-live pen-live-wait">No kicks entered yet.</div>
      <div class="row" style="gap:20px; flex-wrap:wrap; margin-top:10px;">
        ${sideCol("A", m.participantAName || "Team A")}
        ${sideCol("B", m.participantBName || "Team B")}
      </div>
      <div style="margin-top:10px;">
        <button class="btn small" data-save-penalties>Save penalties</button>
        <button class="btn secondary small" data-add-pen-round>+ Add sudden-death kick</button>
      </div>
    </div>
  `;
}

function computePenLiveState(card) {
  const matchId = card.dataset.penCard;
  const statusEl = card.querySelector("[data-pen-live]");
  if (!statusEl) return;
  const readSide = (side) => [...card.querySelectorAll(`[data-pen-shot][data-side="${side}"]`)].map((r) => ({
    name: r.querySelector('[data-field="penName"]').value.trim(),
    result: r.querySelector('[data-field="penResult"]').value,
  }));
  const rowsA = readSide("A"), rowsB = readSide("B");
  const scoreA = rowsA.filter((r) => r.result === "goal").length;
  const scoreB = rowsB.filter((r) => r.result === "goal").length;
  const takenA = rowsA.filter((r) => r.result).length;
  const takenB = rowsB.filter((r) => r.result).length;
  const labelA = eventState.matches.find((m) => m.id === matchId)?.participantAName || "Team A";
  const labelB = eventState.matches.find((m) => m.id === matchId)?.participantBName || "Team B";
  let msg, kind;
  if (takenA === 0 && takenB === 0) {
    msg = "No kicks entered yet.";
    kind = "wait";
  } else if (takenA !== takenB) {
    const waitingOn = takenA < takenB ? labelA : labelB;
    msg = `Current: ${labelA} ${scoreA} – ${scoreB} ${labelB}. Waiting on ${waitingOn}'s next kick to compare evenly.`;
    kind = "wait";
  } else if (scoreA === scoreB) {
    msg = `Level ${scoreA}–${scoreB} after ${takenA} kick${takenA === 1 ? "" : "s"} each — sudden death: add another kick for each side until one is ahead.`;
    kind = "level";
  } else {
    const leader = scoreA > scoreB ? labelA : labelB;
    const hi = Math.max(scoreA, scoreB), lo = Math.min(scoreA, scoreB);
    msg = `${leader} is ahead ${hi}–${lo} after ${takenA} kicks each. If it stays like this, ${leader} wins the shootout.`;
    kind = "lead";
  }
  statusEl.className = `pen-live pen-live-${kind}`;
  statusEl.textContent = msg;
}

function scoreRow(m, scoring, isTeam) {
  const canScore = m.participantAId && m.participantBId;
  const scheduledLocal = m.scheduledAt ? toLocalInputValue(m.scheduledAt) : "";
  const existingGames = Array.isArray(m.games) ? m.games : [];
  const scoreInputsHtml = scoring
    ? `
        <div class="hint" style="margin-top:10px;">Best of ${scoring.bestOf}, each game to ${scoring.pointsToWin} (win by ${scoring.winBy}, capped at ${scoring.cap}). Leave later games blank if the match finished early.</div>
        ${Array.from({ length: scoring.bestOf })
          .map((_, i) => {
            const g = existingGames[i] || ["", ""];
            return `
          <div class="row" data-game style="margin-top:8px; align-items:flex-end;">
            <div class="field" style="max-width:80px;">
              <label class="small">Game ${i + 1} — A</label>
              <input type="number" min="0" data-field="gameA" value="${g[0] ?? ""}">
            </div>
            <div class="field" style="max-width:80px;">
              <label class="small">Game ${i + 1} — B</label>
              <input type="number" min="0" data-field="gameB" value="${g[1] ?? ""}">
            </div>
          </div>`;
          })
          .join("")}
        <div style="margin-top:10px;">
          <button class="btn small" data-save-score>Save score</button>
          ${m.status === "completed" ? `<button class="btn secondary small" data-clear-score>Clear</button>` : ""}
        </div>`
    : `
        <div class="row" style="margin-top:10px; align-items:flex-end;">
          <div class="field" style="max-width:100px;">
            <label class="small">Score A</label>
            <input type="number" min="0" data-field="scoreA" value="${m.scoreA ?? ""}">
          </div>
          <div class="field" style="max-width:100px;">
            <label class="small">Score B</label>
            <input type="number" min="0" data-field="scoreB" value="${m.scoreB ?? ""}">
          </div>
          <button class="btn small" data-save-score>Save score</button>
          ${m.status === "completed" ? `<button class="btn secondary small" data-clear-score>Clear</button>` : ""}
        </div>`;
  return `
    <div class="card" data-match-id="${m.id}" style="padding:14px; margin-bottom:8px;">
      <div class="flex-between">
        <div style="font-weight:600;">${escapeHtml(m.participantAName || "TBD")} <span class="muted">vs</span> ${escapeHtml(m.participantBName || (m.status === "bye" ? "(bye)" : "TBD"))}</div>
        <span class="badge ${m.status === "completed" ? "accent" : ""}">${m.status}</span>
      </div>
      ${
        canScore
          ? `
        ${scoreInputsHtml}
        ${penaltyShootoutHtml(m)}
        ${goalEventsHtml(m, isTeam)}
        ${potmHtml(m, isTeam)}
        <div class="row" style="margin-top:8px; align-items:flex-end;">
          <div class="field">
            <label class="small">Scheduled at</label>
            <input type="datetime-local" data-field="scheduledAt" value="${scheduledLocal}">
          </div>
          <div class="field">
            <label class="small">Venue</label>
            <input type="text" data-field="venue" value="${escapeHtml(m.venue || "")}">
          </div>
          <button class="btn secondary small" data-save-schedule>Save schedule</button>
        </div>
      `
          : `<p class="small muted" style="margin:8px 0 0;">${m.status === "bye" ? "Bye — advances automatically, no match needed." : "Waiting on an earlier match to know who plays here."}</p>`
      }
    </div>
  `;
}

function toLocalInputValue(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function renderMatchdayView(id) {
  content.innerHTML = `<div class="empty-state"><span class="spinner"></span></div>`;
  try {
    const [matchday, signups] = await Promise.all([
      api.get(`/api/admin/matchdays/${id}`),
      api.get(`/api/admin/matchdays/${id}/signups`),
    ]);
    matchdayState = { id, matchday, signups };
  } catch (e) {
    content.innerHTML = `<div class="alert error">${escapeHtml(e.message)}</div><p><a href="#">← Back</a></p>`;
    return;
  }
  drawMatchdayView();
}

async function reloadMatchdayState() {
  const id = matchdayState.id;
  const [matchday, signups] = await Promise.all([
    api.get(`/api/admin/matchdays/${id}`),
    api.get(`/api/admin/matchdays/${id}/signups`),
  ]);
  Object.assign(matchdayState, { matchday, signups });
}

function drawMatchdayView() {
  const { matchday: md, signups } = matchdayState;
  const badge = matchdayStatusBadge(md);

  content.innerHTML = `
    <a href="#" class="small">← All match days</a>

    <div class="event-hero">
      <div class="event-hero-top">
        <div>
          <span class="badge">${badge.label}</span>
          <h1>${escapeHtml(md.name || "Match Day")}</h1>
        </div>
        <a class="small" style="color:#fff;" href="/matchday.html?id=${md.id}" target="_blank">View public page ↗</a>
      </div>
      <div class="event-hero-chips">
        ${md.venue ? `<div class="event-hero-chip"><span class="ehc-icon">📍</span><div><label>Venue</label><div class="ehc-val">${escapeHtml(md.venue)}</div></div></div>` : ""}
        <div class="event-hero-chip"><span class="ehc-icon">📅</span><div><label>Date</label><div class="ehc-val">${escapeHtml(fmtDateOnly(md.date))}</div></div></div>
        ${md.time ? `<div class="event-hero-chip"><span class="ehc-icon">🕒</span><div><label>Time</label><div class="ehc-val">${escapeHtml(md.time)}</div></div></div>` : ""}
        <div class="event-hero-chip"><span class="ehc-icon">👥</span><div><label>Players</label><div class="ehc-val">${md.signupCount}/${md.maxPlayers}</div></div></div>
      </div>
    </div>

    <div class="card" style="margin-top:20px;">
      <div id="matchday-settings-alert"></div>
      <form id="matchday-settings-form">
        <div class="field">
          <label>Name (optional)</label>
          <input name="name" value="${escapeHtml(md.name || "")}" maxlength="100">
        </div>
        <div class="row">
          <div class="field"><label>Venue</label><input name="venue" value="${escapeHtml(md.venue || "")}" maxlength="120"></div>
          <div class="field"><label>Date</label><input name="date" type="date" value="${md.date || ""}" required></div>
          <div class="field"><label>Time</label><input name="time" type="time" value="${md.time || ""}"></div>
        </div>
        <div class="row">
          <div class="field">
            <label>Max players</label>
            <input name="maxPlayers" type="number" min="2" max="200" value="${md.maxPlayers}" required>
          </div>
          <div class="field">
            <label>Signups</label>
            <select name="status">
              <option value="open" ${md.status === "open" ? "selected" : ""}>Open</option>
              <option value="closed" ${md.status === "closed" ? "selected" : ""}>Closed</option>
            </select>
          </div>
        </div>
        <div class="field">
          <label>Notes (optional)</label>
          <textarea name="notes" rows="2">${escapeHtml(md.notes || "")}</textarea>
        </div>
        <button class="btn" type="submit">Save changes</button>
      </form>
    </div>

    <div class="card" style="margin-top:14px;">
      <h3 style="margin-top:0;">Players</h3>
      ${capacityBarHtml(md)}
      <table style="margin-top:14px;">
        <thead><tr><th>#</th><th>Name</th><th></th></tr></thead>
        <tbody>
          ${
            signups.length
              ? signups.map((s, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${escapeHtml(s.name)}</td>
              <td><button class="btn secondary small" data-remove-signup="${s.id}">Remove</button></td>
            </tr>`).join("")
              : `<tr><td colspan="3" class="muted">No one's signed up yet.</td></tr>`
          }
        </tbody>
      </table>
    </div>

    <div class="card" style="margin-top:14px;">
      <h3 style="margin-top:0;">Add a player manually</h3>
      <div id="manual-signup-alert"></div>
      <form id="manual-signup-form">
        <div class="row" style="align-items:flex-end;">
          <div class="field"><label>Name</label><input name="name" required maxlength="60"></div>
          <button class="btn secondary" type="submit">Add</button>
        </div>
      </form>
    </div>

    <div class="card" style="margin-top:14px; border-color: var(--danger);">
      <h3 style="margin-top:0; color:var(--danger);">Danger zone</h3>
      <p class="small muted">Deleting a match day permanently removes its signup list.</p>
      <button class="btn danger" id="delete-matchday-btn">Delete this match day</button>
    </div>
  `;

  document.getElementById("matchday-settings-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    try {
      await api.patch(`/api/admin/matchdays/${matchdayState.id}`, payload);
      await reloadMatchdayState();
      drawMatchdayView();
    } catch (err) {
      document.getElementById("matchday-settings-alert").innerHTML = `<div class="alert error">${escapeHtml(err.message)}</div>`;
    }
  });

  document.getElementById("manual-signup-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    try {
      await api.post(`/api/admin/matchdays/${matchdayState.id}/signups`, payload);
      await reloadMatchdayState();
      drawMatchdayView();
    } catch (err) {
      document.getElementById("manual-signup-alert").innerHTML = `<div class="alert error">${escapeHtml(err.message)}</div>`;
    }
  });

  content.querySelectorAll("[data-remove-signup]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Remove this player from the list?")) return;
      try {
        await api.del(`/api/admin/signups/${btn.dataset.removeSignup}`);
        await reloadMatchdayState();
        drawMatchdayView();
      } catch (err) {
        alert(err.message);
      }
    });
  });

  document.getElementById("delete-matchday-btn").addEventListener("click", async () => {
    if (!confirm(`Delete "${md.name || "this match day"}"? This cannot be undone.`)) return;
    await api.del(`/api/admin/matchdays/${matchdayState.id}`);
    location.hash = "";
    dashState.section = "matchdays";
    renderDashboard();
  });
}

function capacityBarHtml(md) {
  const pct = Math.min(100, Math.round((md.signupCount / md.maxPlayers) * 100));
  return `
    <div class="capacity-bar"><div class="capacity-bar-fill" style="width:${pct}%;"></div></div>
    <div class="capacity-label">${md.signupCount} / ${md.maxPlayers} players signed up</div>
  `;
}

// ----- Communities: clubs/groups with member lists and slot-based games -----

function dashboardCommunityRow(c) {
  const open = c.status === "open";
  return `
    <div class="card" style="cursor:pointer;" data-open-community="${c.id}">
      <div class="flex-between">
        <div>
          <span class="badge ${open ? "accent" : ""}">${open ? "Open" : "Closed"}</span>
          <h3 style="margin:8px 0 4px;">${escapeHtml(c.name)}</h3>
          <div class="small muted">
            ${c.host ? escapeHtml(c.host) + " · " : ""}${c.memberCount} member${c.memberCount === 1 ? "" : "s"} · ${c.upcomingGamesCount} upcoming game${c.upcomingGamesCount === 1 ? "" : "s"}
          </div>
        </div>
        <div class="small muted">Manage →</div>
      </div>
    </div>
  `;
}

function createCommunityFormHtml() {
  const sportOptions = `<option value="">General / mixed</option>` + SPORTS_CACHE.map((s) => `<option value="${s.key}">${escapeHtml(s.label)}</option>`).join("");
  return `
    <h3 style="margin-top:0;">Create a new community</h3>
    <div id="create-community-alert"></div>
    <form id="create-community-form">
      <div class="row">
        <div class="field" style="flex:2;">
          <label>Community name</label>
          <input name="name" required maxlength="100" placeholder="e.g. Lineup Badminton">
        </div>
        <div class="field">
          <label>Sport (optional)</label>
          <select name="sport">${sportOptions}</select>
        </div>
      </div>
      <div class="row">
        <div class="field"><label>Host (optional)</label><input name="host" maxlength="80" placeholder="e.g. Lineup"></div>
        <div class="field"><label>Venue / area (optional)</label><input name="venue" maxlength="120" placeholder="e.g. Business Bay, Dubai"></div>
      </div>
      <div class="field">
        <label>Description (optional)</label>
        <textarea name="description" rows="2"></textarea>
      </div>
      <button class="btn" type="submit">Create community</button>
    </form>
  `;
}

function wireCreateCommunityForm() {
  document.getElementById("create-community-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    try {
      const c = await api.post("/api/admin/communities", payload);
      dashState.showCreateCommunityForm = false;
      location.hash = `community=${c.id}`;
    } catch (err) {
      document.getElementById("create-community-alert").innerHTML = `<div class="alert error">${escapeHtml(err.message)}</div>`;
    }
  });
}

async function renderCommunityView(id) {
  content.innerHTML = `<div class="empty-state"><span class="spinner"></span></div>`;
  try {
    const [c, members, games] = await Promise.all([
      api.get(`/api/admin/communities/${id}`),
      api.get(`/api/admin/communities/${id}/members`),
      api.get(`/api/admin/communities/${id}/games`),
    ]);
    communityState = { id, community: c, members, games, showCreateGameForm: false, openGameId: null };
  } catch (e) {
    content.innerHTML = `<div class="alert error">${escapeHtml(e.message)}</div><p><a href="#">← Back</a></p>`;
    return;
  }
  drawCommunityView();
}

async function reloadCommunityState() {
  const id = communityState.id;
  const [c, members, games] = await Promise.all([
    api.get(`/api/admin/communities/${id}`),
    api.get(`/api/admin/communities/${id}/members`),
    api.get(`/api/admin/communities/${id}/games`),
  ]);
  Object.assign(communityState, { community: c, members, games });
}

function communityGameRow(g) {
  const expanded = communityState.openGameId === g.id;
  const full = g.filledSlots >= g.totalSlots;
  const badgeCls = g.status !== "open" ? "" : full ? "warning" : "accent";
  const badgeLabel = g.status !== "open" ? (g.status === "completed" ? "Completed" : "Closed") : full ? "Full" : "Open";
  return `
    <div class="card" style="margin-top:10px;">
      <div class="flex-between">
        <div>
          <span class="badge ${badgeCls}">${badgeLabel}</span>
          <h3 style="margin:8px 0 4px;">${escapeHtml(g.title || g.sportLabel || "Game")}</h3>
          <div class="small muted">
            ${g.venue ? escapeHtml(g.venue) + " · " : ""}${escapeHtml(fmtDateOnly(g.date))}${g.time ? " · " + escapeHtml(g.time) : ""}
            · ${g.teamSize}v${g.teamSize} · ${g.filledSlots}/${g.totalSlots} players · ${g.entryFee ? "AED " + g.entryFee : "Free"}
          </div>
        </div>
        <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
          <button class="btn secondary small" data-toggle-game="${g.id}">${expanded ? "Hide" : "Manage"}</button>
          <select class="input-like" data-game-status="${g.id}" style="padding:5px 8px; border-radius:8px; border:1px solid var(--border); background:var(--surface); color:var(--text); font-size:0.82rem;">
            <option value="open" ${g.status === "open" ? "selected" : ""}>Open</option>
            <option value="closed" ${g.status === "closed" ? "selected" : ""}>Closed</option>
            <option value="completed" ${g.status === "completed" ? "selected" : ""}>Completed</option>
          </select>
          <button class="btn danger small" data-delete-game="${g.id}">Delete</button>
        </div>
      </div>
      ${expanded ? communityGameSlots(g) : ""}
    </div>
  `;
}

function communityGameSlots(g) {
  const teamA = g.slots.filter((s) => s.team === "A");
  const teamB = g.slots.filter((s) => s.team === "B");
  const slotRow = (s) => `
    <div class="reg-list-item">
      <div>Slot ${s.slotIndex}${s.playerName ? ": <strong>" + escapeHtml(s.playerName) + "</strong>" : ""}</div>
      ${
        s.playerName
          ? `<button class="btn secondary small" data-clear-slot="${s.id}">Clear</button>`
          : `<form class="assign-slot-form" data-slot="${s.id}" style="display:flex; gap:6px;">
              <input name="name" placeholder="Assign a name" maxlength="60" style="width:150px;">
              <button class="btn secondary small" type="submit">Assign</button>
            </form>`
      }
    </div>
  `;
  return `
    <div style="margin-top:14px; border-top:1px solid var(--border); padding-top:14px;">
      <div class="row">
        <div style="flex:1;"><div class="small muted" style="margin-bottom:4px; font-weight:700;">Team A</div>${teamA.map(slotRow).join("")}</div>
        <div style="flex:1;"><div class="small muted" style="margin-bottom:4px; font-weight:700;">Team B</div>${teamB.map(slotRow).join("")}</div>
      </div>
    </div>
  `;
}

function createCommunityGameFormHtml() {
  const sportOptions = `<option value="">Same as community</option>` + SPORTS_CACHE.map((s) => `<option value="${s.key}">${escapeHtml(s.label)}</option>`).join("");
  return `
    <h3 style="margin-top:0;">Create a new game</h3>
    <div id="create-game-alert"></div>
    <form id="create-game-form">
      <div class="row">
        <div class="field"><label>Title (optional)</label><input name="title" maxlength="100" placeholder="e.g. Doubles night"></div>
        <div class="field"><label>Sport</label><select name="sport">${sportOptions}</select></div>
      </div>
      <div class="row">
        <div class="field"><label>Venue</label><input name="venue" maxlength="120"></div>
        <div class="field"><label>Date</label><input name="date" type="date" required></div>
        <div class="field"><label>Time</label><input name="time" type="time"></div>
      </div>
      <div class="row">
        <div class="field">
          <label>Players per team</label>
          <div class="row" style="align-items:center; gap:6px;">
            <button type="button" class="btn secondary small" data-team-preset="2">2</button>
            <button type="button" class="btn secondary small" data-team-preset="3">3</button>
            <button type="button" class="btn secondary small" data-team-preset="4">4</button>
            <button type="button" class="btn secondary small" data-team-preset="6">6</button>
            <input name="teamSize" type="number" min="1" max="11" value="2" style="max-width:80px;" required>
          </div>
        </div>
        <div class="field"><label>Duration (mins)</label><input name="durationMins" type="number" min="15" max="480" value="90"></div>
      </div>
      <div class="row">
        <div class="field"><label>Entry fee (AED)</label><input name="entryFee" type="number" min="0" step="0.5" value="0"></div>
        <div class="field"><label>Original fee (optional)</label><input name="originalFee" type="number" min="0" step="0.5"></div>
        <div class="field" style="display:flex; align-items:flex-end; padding-bottom:9px;">
          <label style="display:flex; align-items:center; gap:6px; font-weight:500; margin:0;"><input name="friendly" type="checkbox" style="width:auto;" checked> Friendly</label>
        </div>
      </div>
      <div class="field"><label>Notes (optional)</label><textarea name="notes" rows="2"></textarea></div>
      <button class="btn" type="submit">Create game</button>
    </form>
  `;
}

function wireCreateCommunityGameForm() {
  const form = document.getElementById("create-game-form");
  form.querySelectorAll("[data-team-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      form.querySelector('[name="teamSize"]').value = btn.dataset.teamPreset;
    });
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const payload = Object.fromEntries(fd.entries());
    payload.friendly = fd.get("friendly") === "on";
    try {
      await api.post(`/api/admin/communities/${communityState.id}/games`, payload);
      communityState.showCreateGameForm = false;
      await reloadCommunityState();
      drawCommunityView();
    } catch (err) {
      document.getElementById("create-game-alert").innerHTML = `<div class="alert error">${escapeHtml(err.message)}</div>`;
    }
  });
}

function drawCommunityView() {
  const { community: c, members, games, showCreateGameForm } = communityState;
  const sportOptions =
    `<option value="">General / mixed</option>` +
    SPORTS_CACHE.map((s) => `<option value="${s.key}" ${c.sport === s.key ? "selected" : ""}>${escapeHtml(s.label)}</option>`).join("");

  content.innerHTML = `
    <a href="#" class="small">← All communities</a>

    <div class="event-hero">
      <div class="event-hero-top">
        <div>
          <span class="badge">${c.status === "open" ? "Open" : "Closed"}</span>
          <h1>${escapeHtml(c.name)}</h1>
          <div class="muted">${escapeHtml(c.sportLabel || "")}${c.host ? " · Host " + escapeHtml(c.host) : ""}</div>
        </div>
        <a class="small" style="color:#fff;" href="/community.html?id=${c.id}" target="_blank">View public page ↗</a>
      </div>
      <div class="event-hero-chips">
        ${c.venue ? `<div class="event-hero-chip"><span class="ehc-icon">📍</span><div><label>Venue</label><div class="ehc-val">${escapeHtml(c.venue)}</div></div></div>` : ""}
        <div class="event-hero-chip"><span class="ehc-icon">👥</span><div><label>Members</label><div class="ehc-val">${c.memberCount}</div></div></div>
        <div class="event-hero-chip"><span class="ehc-icon">🗓️</span><div><label>Games</label><div class="ehc-val">${games.length}</div></div></div>
      </div>
    </div>

    <div class="card" style="margin-top:20px;">
      <div id="community-settings-alert"></div>
      <form id="community-settings-form">
        <div class="row">
          <div class="field" style="flex:2;"><label>Name</label><input name="name" value="${escapeHtml(c.name)}" maxlength="100" required></div>
          <div class="field"><label>Sport</label><select name="sport">${sportOptions}</select></div>
        </div>
        <div class="row">
          <div class="field"><label>Host</label><input name="host" value="${escapeHtml(c.host || "")}" maxlength="80"></div>
          <div class="field"><label>Venue / area</label><input name="venue" value="${escapeHtml(c.venue || "")}" maxlength="120"></div>
          <div class="field">
            <label>Membership</label>
            <select name="status">
              <option value="open" ${c.status === "open" ? "selected" : ""}>Open</option>
              <option value="closed" ${c.status === "closed" ? "selected" : ""}>Closed</option>
            </select>
          </div>
        </div>
        <div class="field"><label>Description</label><textarea name="description" rows="2">${escapeHtml(c.description || "")}</textarea></div>
        <button class="btn" type="submit">Save changes</button>
      </form>
    </div>

    <div class="card" style="margin-top:14px;">
      <h3 style="margin-top:0;">Members (${members.length})</h3>
      <table>
        <thead><tr><th>#</th><th>Name</th><th></th></tr></thead>
        <tbody>
          ${
            members.length
              ? members
                  .map(
                    (m, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${escapeHtml(m.name)}</td>
              <td><button class="btn secondary small" data-remove-member="${m.id}">Remove</button></td>
            </tr>`
                  )
                  .join("")
              : `<tr><td colspan="3" class="muted">No members yet.</td></tr>`
          }
        </tbody>
      </table>
      <div id="manual-member-alert" style="margin-top:10px;"></div>
      <form id="manual-member-form" style="margin-top:10px;">
        <div class="row" style="align-items:flex-end;">
          <div class="field"><label>Add a member manually</label><input name="name" required maxlength="60"></div>
          <button class="btn secondary" type="submit">Add</button>
        </div>
      </form>
    </div>

    <div class="flex-between" style="margin-top:20px;">
      <h2 style="margin:0;">Games</h2>
      <button class="btn" id="new-game-btn">${showCreateGameForm ? "Cancel" : "+ New game"}</button>
    </div>
    ${showCreateGameForm ? `<div class="card" style="margin-top:12px;">${createCommunityGameFormHtml()}</div>` : ""}
    ${games.length ? games.map(communityGameRow).join("") : `<div class="empty-state" style="margin-top:12px;">No games scheduled yet.</div>`}

    <div class="card" style="margin-top:20px; border-color: var(--danger);">
      <h3 style="margin-top:0; color:var(--danger);">Danger zone</h3>
      <p class="small muted">Deleting a community permanently removes its members and games.</p>
      <button class="btn danger" id="delete-community-btn">Delete this community</button>
    </div>
  `;

  document.getElementById("community-settings-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    try {
      await api.patch(`/api/admin/communities/${communityState.id}`, payload);
      await reloadCommunityState();
      drawCommunityView();
    } catch (err) {
      document.getElementById("community-settings-alert").innerHTML = `<div class="alert error">${escapeHtml(err.message)}</div>`;
    }
  });

  document.getElementById("manual-member-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    try {
      await api.post(`/api/admin/communities/${communityState.id}/members`, payload);
      await reloadCommunityState();
      drawCommunityView();
    } catch (err) {
      document.getElementById("manual-member-alert").innerHTML = `<div class="alert error">${escapeHtml(err.message)}</div>`;
    }
  });

  content.querySelectorAll("[data-remove-member]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Remove this member?")) return;
      try {
        await api.del(`/api/admin/community-members/${btn.dataset.removeMember}`);
        await reloadCommunityState();
        drawCommunityView();
      } catch (err) {
        alert(err.message);
      }
    });
  });

  document.getElementById("new-game-btn").addEventListener("click", () => {
    communityState.showCreateGameForm = !communityState.showCreateGameForm;
    drawCommunityView();
  });
  if (showCreateGameForm) wireCreateCommunityGameForm();

  content.querySelectorAll("[data-toggle-game]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.toggleGame;
      communityState.openGameId = communityState.openGameId === id ? null : id;
      drawCommunityView();
    });
  });

  content.querySelectorAll("[data-game-status]").forEach((sel) => {
    sel.addEventListener("change", async () => {
      try {
        await api.patch(`/api/admin/community-games/${sel.dataset.gameStatus}`, { status: sel.value });
        await reloadCommunityState();
        drawCommunityView();
      } catch (err) {
        alert(err.message);
      }
    });
  });

  content.querySelectorAll("[data-delete-game]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this game? This cannot be undone.")) return;
      try {
        await api.del(`/api/admin/community-games/${btn.dataset.deleteGame}`);
        await reloadCommunityState();
        drawCommunityView();
      } catch (err) {
        alert(err.message);
      }
    });
  });

  content.querySelectorAll(".assign-slot-form").forEach((form) => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = new FormData(form).get("name");
      try {
        await api.patch(`/api/admin/community-slots/${form.dataset.slot}`, { name });
        await reloadCommunityState();
        drawCommunityView();
      } catch (err) {
        alert(err.message);
      }
    });
  });

  content.querySelectorAll("[data-clear-slot]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await api.del(`/api/admin/community-slots/${btn.dataset.clearSlot}`);
        await reloadCommunityState();
        drawCommunityView();
      } catch (err) {
        alert(err.message);
      }
    });
  });

  document.getElementById("delete-community-btn").addEventListener("click", async () => {
    if (!confirm(`Delete "${c.name}"? This cannot be undone.`)) return;
    await api.del(`/api/admin/communities/${communityState.id}`);
    location.hash = "";
    dashState.section = "communities";
    renderDashboard();
  });
}

let SPORTS_CACHE = [];
(async function start() {
  try {
    SPORTS_CACHE = await api.get("/api/sports");
  } catch (e) {
    SPORTS_CACHE = [];
  }
  boot();
})();
