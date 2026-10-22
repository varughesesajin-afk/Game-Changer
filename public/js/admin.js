const content = document.getElementById("content");
const logoutLink = document.getElementById("logout-link");

let admin = { isAdmin: false };
let dashState = { events: [], showCreateForm: false };
let eventState = null;

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
  if (eventId) return renderEventView(eventId);
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
    dashState.events = await api.get("/api/admin/events");
  } catch (e) {
    content.innerHTML = `<div class="alert error">${escapeHtml(e.message)}</div>`;
    return;
  }
  drawDashboard();
}

function drawDashboard() {
  const { events, showCreateForm } = dashState;
  content.innerHTML = `
    <div class="flex-between">
      <h1 style="margin:0;">Your events</h1>
      <button class="btn" id="new-event-btn">${showCreateForm ? "Cancel" : "+ New event"}</button>
    </div>

    ${showCreateForm ? `<div class="card" style="margin-top:16px;">${createEventFormHtml()}</div>` : ""}

    <div class="stack" style="margin-top:20px;">
      ${
        events.length
          ? events.map(dashboardEventRow).join("")
          : `<div class="empty-state">No events yet. Create your first one above.</div>`
      }
    </div>
  `;

  document.getElementById("new-event-btn").addEventListener("click", () => {
    dashState.showCreateForm = !dashState.showCreateForm;
    drawDashboard();
  });

  if (showCreateForm) wireCreateEventForm();

  content.querySelectorAll("[data-open-event]").forEach((el) => {
    el.addEventListener("click", () => {
      location.hash = `event=${el.dataset.openEvent}`;
    });
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
    const [event, registrations, matches, suggestion] = await Promise.all([
      api.get(`/api/admin/events/${id}`),
      api.get(`/api/admin/events/${id}/registrations`),
      api.get(`/api/admin/events/${id}/matches`),
      api.get(`/api/admin/events/${id}/suggest-format`),
    ]);
    eventState = { id, event, registrations, matches, suggestion, activeTab: eventState && eventState.id === id ? eventState.activeTab : "settings", selectedFormat: null };
  } catch (e) {
    content.innerHTML = `<div class="alert error">${escapeHtml(e.message)}</div><p><a href="#">← Back</a></p>`;
    return;
  }
  drawEventView();
}

async function reloadEventState() {
  const id = eventState.id;
  const [event, registrations, matches, suggestion] = await Promise.all([
    api.get(`/api/admin/events/${id}`),
    api.get(`/api/admin/events/${id}/registrations`),
    api.get(`/api/admin/events/${id}/matches`),
    api.get(`/api/admin/events/${id}/suggest-format`),
  ]);
  Object.assign(eventState, { event, registrations, matches, suggestion });
}

function drawEventView() {
  const { event, activeTab } = eventState;
  const tabs = [
    ["settings", "Settings"],
    ["registrations", `Registrations (${eventState.registrations.length})`],
    ["fixtures", "Fixture format"],
    ["scores", "Scores & Schedule"],
  ];

  content.innerHTML = `
    <a href="#" class="small">← All events</a>
    <div class="flex-between" style="margin-top:10px;">
      <div>
        <span class="badge ${statusBadgeClass(event.status)}">${escapeHtml(STATUS_LABELS[event.status] || event.status)}</span>
        <h1 style="margin-top:8px;">${escapeHtml(event.name)}</h1>
      </div>
      <a class="small" href="/event.html?id=${event.id}" target="_blank">View public page ↗</a>
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

function drawScoresTab(body) {
  const matches = eventState.matches;
  if (!matches.length) {
    body.innerHTML = `<div class="empty-state">No fixtures yet — generate them from the "Fixture format" tab.</div>`;
    return;
  }

  const groups = [...new Set(matches.filter((m) => m.groupName).map((m) => m.groupName))];
  const stages = [
    ...groups.map((g) => ({ label: g, list: matches.filter((m) => m.groupName === g) })),
    { label: "Round Robin", list: matches.filter((m) => m.stage === "round_robin") },
    { label: "Knockout", list: matches.filter((m) => m.stage === "knockout") },
  ].filter((s) => s.list.length);

  body.innerHTML = stages
    .map((stage) => {
      const rounds = [...new Set(stage.list.map((m) => m.round))].sort((a, b) => a - b);
      return `
        <h3>${escapeHtml(stage.label)}</h3>
        ${rounds
          .map((r) => {
            const roundMatches = stage.list.filter((m) => m.round === r);
            const roundName = roundMatches[0].roundName;
            return `<div class="round-heading">${escapeHtml(roundName)}</div>${roundMatches.map(scoreRow).join("")}`;
          })
          .join("")}
      `;
    })
    .join("");

  body.querySelectorAll("[data-save-score]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const row = btn.closest("[data-match-id]");
      const id = row.dataset.matchId;
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

function scoreRow(m) {
  const canScore = m.participantAId && m.participantBId;
  const scheduledLocal = m.scheduledAt ? toLocalInputValue(m.scheduledAt) : "";
  return `
    <div class="card" data-match-id="${m.id}" style="padding:14px; margin-bottom:8px;">
      <div class="flex-between">
        <div style="font-weight:600;">${escapeHtml(m.participantAName || "TBD")} <span class="muted">vs</span> ${escapeHtml(m.participantBName || (m.status === "bye" ? "(bye)" : "TBD"))}</div>
        <span class="badge ${m.status === "completed" ? "accent" : ""}">${m.status}</span>
      </div>
      ${
        canScore
          ? `
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
        </div>
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

let SPORTS_CACHE = [];
(async function start() {
  try {
    SPORTS_CACHE = await api.get("/api/sports");
  } catch (e) {
    SPORTS_CACHE = [];
  }
  boot();
})();
