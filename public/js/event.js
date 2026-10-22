const params = new URLSearchParams(location.search);
const eventId = params.get("id");
const content = document.getElementById("content");

let state = { event: null, registrations: [], matches: [], standings: null, activeTab: "register" };

async function init() {
  if (!eventId) {
    content.innerHTML = `<div class="alert error">No event specified.</div>`;
    return;
  }
  try {
    const [event, registrations, matches, standings] = await Promise.all([
      api.get(`/api/events/${eventId}`),
      api.get(`/api/events/${eventId}/registrations`),
      api.get(`/api/events/${eventId}/fixtures`),
      api.get(`/api/events/${eventId}/standings`),
    ]);
    state.event = event;
    state.registrations = registrations;
    state.matches = matches;
    state.standings = standings;
    state.activeTab = event.status === "registration_open" ? "register" : "participants";
    render();
  } catch (e) {
    content.innerHTML = `<div class="alert error">Couldn't load this event: ${escapeHtml(e.message)}</div>`;
  }
}

async function refreshData() {
  const [event, registrations, matches, standings] = await Promise.all([
    api.get(`/api/events/${eventId}`),
    api.get(`/api/events/${eventId}/registrations`),
    api.get(`/api/events/${eventId}/fixtures`),
    api.get(`/api/events/${eventId}/standings`),
  ]);
  state.event = event;
  state.registrations = registrations;
  state.matches = matches;
  state.standings = standings;
  render();
}

function render() {
  const ev = state.event;
  const noun = ev.category === "individual" ? "Players" : "Teams";
  const hasFixtures = state.matches.length > 0;

  const tabs = [];
  if (ev.status === "registration_open") tabs.push(["register", "Register"]);
  tabs.push(["participants", `${noun} (${state.registrations.length})`]);
  if (hasFixtures) tabs.push(["fixtures", "Fixtures & Schedule"]);
  if (hasFixtures) tabs.push(["standings", "Standings"]);
  if (!tabs.find(([id]) => id === state.activeTab)) state.activeTab = tabs[0][0];

  content.innerHTML = `
    <a href="/" class="small">← All events</a>
    <div class="flex-between" style="margin-top:10px;">
      <div>
        <span class="badge ${statusBadgeClass(ev.status)}">${escapeHtml(STATUS_LABELS[ev.status] || ev.status)}</span>
        <h1 style="margin-top:8px;">${escapeHtml(ev.name)}</h1>
        <div class="muted">${escapeHtml(ev.sportLabel)}${ev.venue ? " · " + escapeHtml(ev.venue) : ""}${ev.startDate ? " · " + escapeHtml(fmtDateOnly(ev.startDate)) : ""}</div>
      </div>
    </div>
    ${ev.description ? `<p style="margin-top:14px;">${escapeHtml(ev.description)}</p>` : ""}

    <div class="tabs" style="margin-top:24px;">
      ${tabs.map(([id, label]) => `<div class="tab ${state.activeTab === id ? "active" : ""}" data-tab="${id}">${label}</div>`).join("")}
    </div>

    <div id="tab-body"></div>
  `;

  content.querySelectorAll(".tab").forEach((t) => {
    t.addEventListener("click", () => {
      state.activeTab = t.dataset.tab;
      render();
    });
  });

  const body = document.getElementById("tab-body");
  if (state.activeTab === "register") body.innerHTML = renderRegisterTab();
  if (state.activeTab === "participants") body.innerHTML = renderParticipantsTab();
  if (state.activeTab === "fixtures") body.innerHTML = renderFixturesTab();
  if (state.activeTab === "standings") body.innerHTML = renderStandingsTab();

  if (state.activeTab === "register") wireRegisterForm();
}

function renderRegisterTab() {
  const ev = state.event;
  const isIndividual = ev.category === "individual";
  return `
    <div class="card">
      <h3 style="margin-top:0;">${isIndividual ? "Register to play" : "Register your team"}</h3>
      <div id="reg-alert"></div>
      <form id="reg-form">
        <div class="field">
          <label>${isIndividual ? "Your name" : "Team name"}</label>
          <input name="name" required maxlength="80">
        </div>
        <div class="field">
          <label>${isIndividual ? "Playing partner (optional, for doubles)" : "Roster (optional — one player name per line)"}</label>
          <textarea name="members" rows="${isIndividual ? 1 : 4}" placeholder="${isIndividual ? "Partner's name" : "Jane Doe\nJohn Smith\n..."}"></textarea>
        </div>
        <div class="row">
          <div class="field">
            <label>Contact name</label>
            <input name="contactName" required maxlength="80">
          </div>
          <div class="field">
            <label>Contact email</label>
            <input name="contactEmail" type="email" maxlength="120">
          </div>
          <div class="field">
            <label>Contact phone</label>
            <input name="contactPhone" type="tel" maxlength="40">
          </div>
        </div>
        <div class="hint" style="margin-bottom:14px;">Provide at least an email or a phone number so the organizer can reach you.</div>
        <button class="btn" type="submit">Submit registration</button>
      </form>
    </div>
  `;
}

function wireRegisterForm() {
  const form = document.getElementById("reg-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const members = String(fd.get("members") || "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const payload = {
      name: fd.get("name"),
      members,
      contactName: fd.get("contactName"),
      contactEmail: fd.get("contactEmail"),
      contactPhone: fd.get("contactPhone"),
    };
    const alertBox = document.getElementById("reg-alert");
    const btn = form.querySelector("button");
    btn.disabled = true;
    try {
      await api.post(`/api/events/${eventId}/register`, payload);
      await refreshData();
      state.activeTab = "participants";
      render();
    } catch (err) {
      alertBox.innerHTML = `<div class="alert error">${escapeHtml(err.message)}</div>`;
      btn.disabled = false;
    }
  });
}

function renderParticipantsTab() {
  if (!state.registrations.length) {
    return `<div class="empty-state">No one has registered yet.</div>`;
  }
  return `
    <div class="card">
      ${state.registrations
        .map(
          (r) => `
        <div class="reg-list-item">
          <div>
            <div style="font-weight:600;">${escapeHtml(r.name)}</div>
            ${r.members && r.members.length ? `<div class="small muted">${r.members.map(escapeHtml).join(", ")}</div>` : ""}
          </div>
        </div>`
        )
        .join("")}
    </div>
  `;
}

function matchLine(m) {
  const played = m.status === "completed";
  const isBye = m.status === "bye";
  return `
    <div class="match-row">
      <div>
        <div class="match-participants">
          <span>${escapeHtml(m.participantAName || "TBD")}</span>
          ${played ? `<span class="match-score">${m.scoreA} – ${m.scoreB}</span>` : `<span class="muted">vs</span>`}
          <span>${escapeHtml(isBye ? "(bye)" : m.participantBName || "TBD")}</span>
        </div>
        <div class="match-meta">
          ${m.scheduledAt ? `📅 ${escapeHtml(fmtDate(m.scheduledAt))}` : ""}
          ${m.venue ? ` · 📍 ${escapeHtml(m.venue)}` : ""}
        </div>
      </div>
      <span class="badge ${played ? "accent" : ""}">${played ? "Final" : isBye ? "Bye" : m.status === "pending" ? "Awaiting qualifiers" : "Scheduled"}</span>
    </div>
  `;
}

function renderFixturesTab() {
  const matches = state.matches;
  if (!matches.length) return `<div class="empty-state">Fixtures haven't been generated yet.</div>`;

  const groups = [...new Set(matches.filter((m) => m.groupName).map((m) => m.groupName))];
  const knockout = matches.filter((m) => m.stage === "knockout");
  const roundRobin = matches.filter((m) => m.stage === "round_robin");

  let html = "";

  if (roundRobin.length) {
    const rounds = [...new Set(roundRobin.map((m) => m.round))].sort((a, b) => a - b);
    rounds.forEach((r) => {
      html += `<div class="round-heading">Round ${r}</div>`;
      html += roundRobin.filter((m) => m.round === r).map(matchLine).join("");
    });
  }

  groups.forEach((g) => {
    html += `<h3>${escapeHtml(g)}</h3>`;
    const groupMatches = matches.filter((m) => m.groupName === g);
    const rounds = [...new Set(groupMatches.map((m) => m.round))].sort((a, b) => a - b);
    rounds.forEach((r) => {
      html += groupMatches.filter((m) => m.round === r).map(matchLine).join("");
    });
  });

  if (knockout.length) {
    if (groups.length) html += `<h3>Knockout stage</h3>`;
    const rounds = [...new Set(knockout.map((m) => m.round))].sort((a, b) => a - b);
    rounds.forEach((r) => {
      const roundName = knockout.find((m) => m.round === r).roundName;
      html += `<div class="round-heading">${escapeHtml(roundName)}</div>`;
      html += knockout.filter((m) => m.round === r).map(matchLine).join("");
    });
  }

  return html;
}

function standingsTable(rows) {
  return `
    <table>
      <thead><tr><th>#</th><th>${state.event.category === "individual" ? "Player" : "Team"}</th><th>P</th><th>W</th><th>D</th><th>L</th><th>Pts</th></tr></thead>
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
            <td><strong>${r.points}</strong></td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function renderStandingsTab() {
  const s = state.standings;
  let html = "";
  if (s.overall && s.overall.length) {
    html += `<div class="card">${standingsTable(s.overall)}</div>`;
  }
  if (s.groups && s.groups.length) {
    s.groups.forEach((g) => {
      html += `<h3>${escapeHtml(g.name)}</h3><div class="card">${standingsTable(g.standings)}</div>`;
    });
  }
  if (!html) {
    html = `<div class="empty-state">This event's format doesn't produce a league table — check the Fixtures tab for the bracket.</div>`;
  }
  return html;
}

init();
