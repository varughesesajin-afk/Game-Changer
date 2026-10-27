const params = new URLSearchParams(location.search);
const matchdayId = params.get("id");
const content = document.getElementById("content");

let state = { matchday: null, signups: [] };

async function init() {
  if (!matchdayId) {
    content.innerHTML = `<div class="alert error">No match day specified.</div>`;
    return;
  }
  try {
    await load();
  } catch (e) {
    content.innerHTML = `<div class="alert error">Couldn't load this match day: ${escapeHtml(e.message)}</div>`;
  }
}

async function load() {
  const [matchday, signups] = await Promise.all([
    api.get(`/api/matchdays/${matchdayId}`),
    api.get(`/api/matchdays/${matchdayId}/signups`),
  ]);
  state.matchday = matchday;
  state.signups = signups;
  render();
}

function capacityBar(md) {
  const pct = Math.min(100, Math.round((md.signupCount / md.maxPlayers) * 100));
  return `
    <div class="capacity-bar"><div class="capacity-bar-fill" style="width:${pct}%;"></div></div>
    <div class="capacity-label">${md.signupCount} / ${md.maxPlayers} players signed up</div>
  `;
}

function render() {
  const md = state.matchday;
  const full = md.signupCount >= md.maxPlayers;
  const closed = md.status !== "open";
  const badgeClass = closed ? "" : full ? "warning" : "accent";
  const badgeLabel = closed ? "Signups closed" : full ? "Full" : "Open";

  content.innerHTML = `
    <a href="/matchdays.html" class="small">← All match days</a>

    <div class="event-hero">
      <div class="event-hero-top">
        <div>
          <span class="badge">${badgeLabel}</span>
          <h1>${escapeHtml(md.name || "Match Day")}</h1>
        </div>
      </div>
      <div class="event-hero-chips">
        ${md.venue ? `<div class="event-hero-chip"><span class="ehc-icon">📍</span><div><label>Venue</label><div class="ehc-val">${escapeHtml(md.venue)}</div></div></div>` : ""}
        <div class="event-hero-chip"><span class="ehc-icon">📅</span><div><label>Date</label><div class="ehc-val">${escapeHtml(fmtDateOnly(md.date))}</div></div></div>
        ${md.time ? `<div class="event-hero-chip"><span class="ehc-icon">🕒</span><div><label>Time</label><div class="ehc-val">${escapeHtml(md.time)}</div></div></div>` : ""}
        <div class="event-hero-chip"><span class="ehc-icon">👥</span><div><label>Players</label><div class="ehc-val">${md.signupCount}/${md.maxPlayers}</div></div></div>
      </div>
    </div>
    ${md.notes ? `<p style="margin-top:14px;">${escapeHtml(md.notes)}</p>` : ""}

    <div class="card" style="margin-top:20px;">
      <h3 style="margin-top:0;">Players</h3>
      ${capacityBar(md)}
      <div style="margin-top:14px;">
        ${
          state.signups.length
            ? state.signups.map((s, i) => `<div class="reg-list-item"><div>${i + 1}. ${escapeHtml(s.name)}</div></div>`).join("")
            : `<div class="empty-state">No one's signed up yet — be the first!</div>`
        }
      </div>
    </div>

    <div class="card" style="margin-top:14px;">
      ${
        closed
          ? `<div class="alert info">Signups are closed for this match day.</div>`
          : full
            ? `<div class="alert info">This match day is full. Contact the organizer if you'd like to be added to a waitlist.</div>`
            : `
            <h3 style="margin-top:0;">Add your name</h3>
            <div id="join-alert"></div>
            <form id="join-form">
              <div class="row" style="align-items:flex-end;">
                <div class="field"><label>Your name</label><input name="name" required maxlength="60"></div>
                <button class="btn" type="submit" style="margin-bottom:14px;">Join</button>
              </div>
            </form>
          `
      }
    </div>
  `;

  const form = document.getElementById("join-form");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = new FormData(form).get("name");
      const alertBox = document.getElementById("join-alert");
      const btn = form.querySelector("button");
      btn.disabled = true;
      try {
        await api.post(`/api/matchdays/${matchdayId}/join`, { name });
        await load();
      } catch (err) {
        alertBox.innerHTML = `<div class="alert error">${escapeHtml(err.message)}</div>`;
        btn.disabled = false;
      }
    });
  }
}

init();
