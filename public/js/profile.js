const content = document.getElementById("content");

function initials(name) {
  return String(name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function communityRow(c) {
  const closed = c.status !== "open";
  const img = sportImageUrl(c.sport);
  return `
    <a class="card list-card" href="/community.html?id=${encodeURIComponent(c.id)}">
      <div class="lc-thumb" style="background-image:url('${img}');"></div>
      <div class="lc-body">
        <span class="badge ${closed ? "" : "accent"}">${closed ? "Closed" : "Open"}</span>
        <h3>${escapeHtml(c.name)}</h3>
        <div class="lc-meta">
          <span>${c.host ? "Host · " + escapeHtml(c.host) : escapeHtml(c.sportLabel || "")}</span>
          <span>${c.memberCount} member${c.memberCount === 1 ? "" : "s"}</span>
        </div>
      </div>
    </a>
  `;
}

function gameRow(g) {
  const closed = g.status !== "open";
  const img = sportImageUrl(g.sport);
  return `
    <a class="card list-card" href="/community-game.html?id=${encodeURIComponent(g.id)}">
      <div class="lc-thumb" style="background-image:url('${img}');"></div>
      <div class="lc-body">
        <span class="badge ${closed ? "" : "accent"}">${closed ? (g.status === "completed" ? "Completed" : "Closed") : "Team " + escapeHtml(g.myTeam || "")}</span>
        <h3>${escapeHtml(g.title || g.sportLabel || "Game")}</h3>
        <div class="lc-meta">
          <span>${escapeHtml(g.communityName || "")}</span>
          ${g.venue ? `<span>📍 ${escapeHtml(g.venue)}</span>` : ""}
          <span>📅 ${escapeHtml(fmtDateOnly(g.date))}${g.time ? " · " + escapeHtml(fmtTime(g.time)) : ""}</span>
        </div>
      </div>
    </a>
  `;
}

async function renderLoggedOut(loginError) {
  content.innerHTML = `
    <p class="eyebrow">My Games</p>
    <div class="photo-hero" style="--hero-img:url('/images/sports/default.svg'); min-height:220px;">
      <span class="badge brand">👤 Sign in</span>
      <h1>Keep track of your games</h1>
      <p>Sign in with Google to join communities, claim game spots, and see everything you're playing.</p>
    </div>
    ${loginError ? `<div class="alert error" style="margin-top:14px;">${escapeHtml(loginError)}</div>` : ""}
    <div style="margin-top:18px;">${signInButtonHtml("Continue with Google")}</div>
  `;
}

async function renderLoggedIn(me) {
  content.innerHTML = `
    <p class="eyebrow">My Games</p>
    <div class="card flex-between" style="align-items:center;">
      <div style="display:flex; align-items:center; gap:12px;">
        ${
          me.picture
            ? `<img src="${escapeHtml(me.picture)}" alt="" style="width:48px; height:48px; border-radius:50%;">`
            : `<div class="member-avatar" style="width:48px; height:48px; font-size:16px;">${escapeHtml(initials(me.name))}</div>`
        }
        <div>
          <div style="font-weight:600;">${escapeHtml(me.name)}</div>
          ${me.email ? `<div class="small muted">${escapeHtml(me.email)}</div>` : ""}
        </div>
      </div>
      <button class="btn secondary small" id="logout-btn">Log out</button>
    </div>

    <div class="segmented" id="profile-tabs" style="margin-top:20px;">
      <button class="active" data-ptab="games">Your games</button>
      <button data-ptab="communities">Your communities</button>
    </div>

    <div id="my-games" style="margin-top:16px; display:flex; flex-direction:column; gap:10px;"><div class="empty-state"><span class="spinner"></span></div></div>
    <div id="my-communities" style="margin-top:16px; display:none; flex-direction:column; gap:10px;"><div class="empty-state"><span class="spinner"></span></div></div>
  `;

  document.getElementById("logout-btn").addEventListener("click", async () => {
    await api.post("/api/auth/logout", {});
    location.reload();
  });

  document.querySelectorAll("#profile-tabs [data-ptab]").forEach((t) => {
    t.addEventListener("click", () => {
      document.querySelectorAll("#profile-tabs [data-ptab]").forEach((x) => x.classList.toggle("active", x === t));
      document.getElementById("my-games").style.display = t.dataset.ptab === "games" ? "flex" : "none";
      document.getElementById("my-communities").style.display = t.dataset.ptab === "communities" ? "flex" : "none";
    });
  });

  try {
    const [communities, games] = await Promise.all([api.get("/api/me/communities"), api.get("/api/me/games")]);
    document.getElementById("my-communities").innerHTML = communities.length
      ? communities.map(communityRow).join("")
      : `<div class="empty-state">You haven't joined any communities yet. <a href="/communities.html">Browse communities</a></div>`;
    document.getElementById("my-games").innerHTML = games.length
      ? games.map(gameRow).join("")
      : `<div class="empty-state">You haven't claimed a spot in any games yet. <a href="/tourneys.html">Browse Tourneys</a></div>`;
  } catch (e) {
    document.getElementById("my-communities").innerHTML = `<div class="alert error">${escapeHtml(e.message)}</div>`;
    document.getElementById("my-games").innerHTML = "";
  }
}

async function init() {
  const loginError = readLoginError();
  try {
    const { user } = await whoAmI(true);
    if (user) {
      await renderLoggedIn(user);
    } else {
      await renderLoggedOut(loginError);
    }
  } catch (e) {
    content.innerHTML = `<div class="alert error">Couldn't load your profile: ${escapeHtml(e.message)}</div>`;
  }
}

init();
