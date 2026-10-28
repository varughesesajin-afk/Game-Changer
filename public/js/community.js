const params = new URLSearchParams(location.search);
const communityId = params.get("id");
const content = document.getElementById("content");

let state = { community: null, members: [], games: [] };

async function init() {
  if (!communityId) {
    content.innerHTML = `<div class="alert error">No community specified.</div>`;
    return;
  }
  try {
    await load();
  } catch (e) {
    content.innerHTML = `<div class="alert error">Couldn't load this community: ${escapeHtml(e.message)}</div>`;
  }
}

async function load() {
  const [community, members, games] = await Promise.all([
    api.get(`/api/communities/${communityId}`),
    api.get(`/api/communities/${communityId}/members`),
    api.get(`/api/communities/${communityId}/games`),
  ]);
  state.community = community;
  state.members = members;
  state.games = games;
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

function gameCard(g) {
  const full = g.filledSlots >= g.totalSlots;
  const closed = g.status !== "open";
  const badgeClass = closed ? "" : full ? "warning" : "accent";
  const badgeLabel = closed ? (g.status === "completed" ? "Completed" : "Closed") : full ? "Full" : "Open";
  return `
    <a class="event-card" href="/community-game.html?id=${encodeURIComponent(g.id)}">
      <span class="badge ${badgeClass}">${badgeLabel}</span>
      <h3>${escapeHtml(g.title || g.sportLabel || "Game")}</h3>
      ${g.venue ? `<div class="muted small">📍 ${escapeHtml(g.venue)}</div>` : ""}
      <div class="small muted">📅 ${escapeHtml(fmtDateOnly(g.date))}${g.time ? " · " + escapeHtml(fmtTime(g.time)) : ""}</div>
      <div class="small muted">${g.filledSlots}/${g.totalSlots} players · ${g.entryFee ? "AED " + g.entryFee : "Free"}</div>
    </a>
  `;
}

function render() {
  const c = state.community;
  const closed = c.status !== "open";
  const joined = myCommunityIds().includes(c.id);

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

    ${c.description ? `<p style="margin-top:14px;">${escapeHtml(c.description)}</p>` : ""}

    <div class="flex-between" style="margin-top:18px;">
      ${
        joined
          ? `<div class="badge accent">✓ You're a member</div>`
          : closed
            ? `<div class="muted small">This community isn't open to new members right now.</div>`
            : `<button class="btn" id="join-btn">Join community</button>`
      }
    </div>
    <div id="join-alert"></div>

    <h2>Members (${state.members.length})</h2>
    ${
      state.members.length
        ? `<div class="card"><div class="member-avatars">${state.members
            .slice(0, 24)
            .map((m) => `<div class="member-avatar" title="${escapeHtml(m.name)}">${escapeHtml(initials(m.name))}</div>`)
            .join("")}</div></div>`
        : `<div class="empty-state">No members yet — be the first to join!</div>`
    }

    <h2>Upcoming games</h2>
    ${state.games.length ? `<div class="grid">${state.games.map(gameCard).join("")}</div>` : `<div class="empty-state">No games scheduled yet.</div>`}
  `;

  const joinBtn = document.getElementById("join-btn");
  if (joinBtn) {
    joinBtn.addEventListener("click", () => {
      content.querySelector("#join-alert").innerHTML = `
        <div class="card" style="margin-top:10px; max-width:360px;">
          <form id="join-form">
            <div class="field"><label>Your name</label><input name="name" required maxlength="60" autofocus></div>
            <button class="btn" type="submit">Confirm</button>
          </form>
        </div>
      `;
      document.getElementById("join-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = new FormData(e.target).get("name");
        const btn = e.target.querySelector("button");
        btn.disabled = true;
        try {
          await api.post(`/api/communities/${communityId}/join`, { name });
          markCommunityJoined(communityId);
          await load();
        } catch (err) {
          content.querySelector("#join-alert").innerHTML = `<div class="alert error">${escapeHtml(err.message)}</div>`;
        }
      });
    });
  }
}

init();
