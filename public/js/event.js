const params = new URLSearchParams(location.search);
const eventId = params.get("id");
const content = document.getElementById("content");

let state = { event: null, registrations: [], matches: [], standings: null, stats: null, players: [], activeTab: "register" };

async function init() {
  if (!eventId) {
    content.innerHTML = `<div class="alert error">No event specified.</div>`;
    return;
  }
  try {
    const [event, registrations, matches, standings, stats, players] = await Promise.all([
      api.get(`/api/events/${eventId}`),
      api.get(`/api/events/${eventId}/registrations`),
      api.get(`/api/events/${eventId}/fixtures`),
      api.get(`/api/events/${eventId}/standings`),
      api.get(`/api/events/${eventId}/stats`),
      api.get(`/api/events/${eventId}/players`),
    ]);
    state.event = event;
    state.registrations = registrations;
    state.matches = matches;
    state.standings = standings;
    state.stats = stats;
    state.players = players;
    state.activeTab = event.status === "registration_open" ? "register" : "participants";
    render();
  } catch (e) {
    content.innerHTML = `<div class="alert error">Couldn't load this event: ${escapeHtml(e.message)}</div>`;
  }
}

async function refreshData() {
  const [event, registrations, matches, standings, stats, players] = await Promise.all([
    api.get(`/api/events/${eventId}`),
    api.get(`/api/events/${eventId}/registrations`),
    api.get(`/api/events/${eventId}/fixtures`),
    api.get(`/api/events/${eventId}/standings`),
    api.get(`/api/events/${eventId}/stats`),
    api.get(`/api/events/${eventId}/players`),
  ]);
  state.event = event;
  state.registrations = registrations;
  state.matches = matches;
  state.standings = standings;
  state.stats = stats;
  state.players = players;
  render();
}

function render() {
  const ev = state.event;
  const noun = ev.category === "individual" ? "Players" : "Teams";
  const hasFixtures = state.matches.length > 0;
  const hasStats =
    ev.category !== "individual" &&
    state.stats &&
    (state.stats.topScorers.length || state.stats.topAssists.length || state.stats.bestDefense.length || (state.stats.potmLeaders && state.stats.potmLeaders.length));
  const hasPlayers = state.players && state.players.length > 0;

  const tabs = [];
  if (ev.status === "registration_open") tabs.push(["register", "Register"]);
  tabs.push(["participants", `${noun} (${state.registrations.length})`]);
  if (hasFixtures) tabs.push(["fixtures", "Fixtures & Schedule"]);
  if (hasFixtures) tabs.push(["standings", "Standings"]);
  if (hasStats) tabs.push(["stats", "Top Scorers"]);
  if (hasPlayers) tabs.push(["players", "Player Ratings"]);
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

    ${formatSummaryCard(ev)}

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
  if (state.activeTab === "stats") body.innerHTML = renderStatsTab();
  if (state.activeTab === "players") body.innerHTML = renderPlayersTab();

  if (state.activeTab === "register") wireRegisterForm();
}

function formatSummaryCard(ev) {
  const noun = ev.category === "individual" ? "players" : "teams";
  return `
    <div class="card format-summary" style="margin-top:16px;">
      <div class="format-summary-grid">
        <div><label>Sport</label><div>${escapeHtml(ev.sportLabel)}</div></div>
        <div><label>Category</label><div>${ev.category === "individual" ? "Individual" : "Team"}</div></div>
        <div><label>Entrants</label><div>${ev.registrationCount} ${noun}</div></div>
        ${ev.venue ? `<div><label>Venue</label><div>${escapeHtml(ev.venue)}</div></div>` : ""}
        ${ev.startDate ? `<div><label>Start date</label><div>${escapeHtml(fmtDateOnly(ev.startDate))}</div></div>` : ""}
      </div>
      <div class="format-summary-rules">${formatRulesText(ev)}</div>
    </div>
  `;
}

function formatRulesText(ev) {
  if (!ev.format) {
    return `<span class="muted">Format hasn't been decided yet — check back once the organizer generates fixtures.</span>`;
  }
  if (ev.format === "round_robin") {
    return `<strong>Round robin</strong> — every entrant plays every other entrant once. Ranked by points (3 for a win${ev.allowDraws === false ? "" : ", 1 for a draw"}), then goal difference.`;
  }
  if (ev.format === "knockout") {
    return `<strong>Single-elimination knockout</strong> — lose once and you're out. Byes are awarded automatically when the bracket isn't a perfect power of two.`;
  }
  if (ev.format === "group_knockout") {
    return `<strong>Groups + knockout</strong> — entrants are split into groups to play round robin${
      ev.advancePerGroup ? `; the top ${ev.advancePerGroup} from each group advance to` : ", then qualifiers advance to"
    } a single-elimination knockout stage.`;
  }
  return "";
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

function renderPlayersTab() {
  if (!state.players.length) return `<div class="empty-state">No player stats yet.</div>`;
  const isIndividual = state.event.category === "individual";
  return `
    <div class="hint" style="margin-bottom:12px;">OVR is a quick, transparent rating from this event's results${isIndividual ? " (wins/draws/losses)" : " (goals, assists, and Player of the Match tags)"} — not an official ranking.</div>
    <div class="grid">${state.players.map((p) => playerCard(p, isIndividual)).join("")}</div>
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

function renderStatsTab() {
  const s = state.stats;
  return `
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
  const hasGames = Array.isArray(m.games) && m.games.length > 0;
  const showScore = played || (hasGames && (m.scoreA > 0 || m.scoreB > 0));
  const hasPens = m.penalties && m.penalties.shots && m.penalties.shots.length > 0;
  const goalEvents = Array.isArray(m.goalEvents) ? m.goalEvents : [];
  const goalsFor = (side) => goalEvents.filter((g) => g.side === side);
  const goalLine = (g) => `⚽ ${escapeHtml(g.scorer)}${g.assist ? ` <span class="muted">(assist: ${escapeHtml(g.assist)})</span>` : ""}`;
  return `
    <div class="match-row">
      <div>
        <div class="match-participants">
          <span>${escapeHtml(m.participantAName || "TBD")}</span>
          ${showScore ? `<span class="match-score">${m.scoreA} – ${m.scoreB}${hasPens ? ` <span class="small muted">(pens ${m.penalties.scoreA}-${m.penalties.scoreB})</span>` : ""}</span>` : `<span class="muted">vs</span>`}
          <span>${escapeHtml(isBye ? "(bye)" : m.participantBName || "TBD")}</span>
        </div>
        ${hasGames ? `<div class="small muted">${m.games.map(([a, b]) => `${a}-${b}`).join(", ")}</div>` : ""}
        ${
          goalEvents.length
            ? `<div class="small muted" style="display:flex; gap:24px; margin-top:2px;">
                <div>${goalsFor("A").map(goalLine).join("<br>")}</div>
                <div>${goalsFor("B").map(goalLine).join("<br>")}</div>
              </div>`
            : ""
        }
        ${played && m.winnerName ? `<div class="small muted">${escapeHtml(m.winnerName)} won${hasPens ? " on penalties" : ""}</div>` : ""}
        ${m.potm && m.potm.name ? `<div class="small">⭐ POTM: ${escapeHtml(m.potm.name)}</div>` : ""}
        <div class="match-meta">
          ${m.scheduledAt ? `📅 ${escapeHtml(fmtDate(m.scheduledAt))}` : ""}
          ${m.venue ? ` · 📍 ${escapeHtml(m.venue)}` : ""}
        </div>
      </div>
      <span class="badge ${played ? "accent" : ""}">${played ? "Final" : isBye ? "Bye" : m.status === "pending" ? "Awaiting qualifiers" : "Scheduled"}</span>
    </div>
  `;
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
    html += renderBracket(knockout);
  }

  return html;
}

function standingsTable(rows) {
  return `
    <table>
      <thead><tr><th>#</th><th>${state.event.category === "individual" ? "Player" : "Team"}</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr></thead>
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
