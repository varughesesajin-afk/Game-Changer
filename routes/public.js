const { Router } = require("../lib/miniweb");
const db = require("../lib/db");
const { getSport, SPORTS } = require("../lib/sports");
const { suggestFormat } = require("../lib/fixtures");
const matchService = require("../lib/matchService");
const community = require("../lib/communityService");
const users = require("../lib/userService");
const googleAuth = require("../lib/googleAuth");
const { GOOGLE_LOGIN_ENABLED } = require("../lib/config");
const { publicEvent, publicRegistration, publicMatch } = require("../lib/serialize");

const router = new Router();

// This router's get/post only accept a single handler (no per-route middleware
// chains — see lib/miniweb.js), so auth-gating a route means wrapping its
// handler rather than passing a separate middleware function.
function withUser(handler) {
  return (req, res) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: "Please sign in with Google to continue." });
    }
    return handler(req, res);
  };
}

// ----- Sign in with Google -----

router.get("/auth/google/login", (req, res) => {
  if (!GOOGLE_LOGIN_ENABLED) {
    return res.status(503).json({ error: "Sign-in with Google isn't set up yet." });
  }
  const state = googleAuth.randomState();
  req.session.oauthState = state;
  const next = typeof req.query.next === "string" && req.query.next.startsWith("/") ? req.query.next : "/profile.html";
  req.session.oauthNext = next;
  res.redirect(googleAuth.buildAuthUrl(state));
});

router.get("/auth/google/callback", async (req, res) => {
  const next = req.session.oauthNext || "/profile.html";
  try {
    if (!GOOGLE_LOGIN_ENABLED) throw new Error("Sign-in with Google isn't set up yet.");
    const { code, state, error } = req.query || {};
    if (error) throw new Error("Google sign-in was cancelled.");
    if (!code || !state || state !== req.session.oauthState) {
      throw new Error("That sign-in link expired. Please try again.");
    }
    delete req.session.oauthState;
    const tokens = await googleAuth.exchangeCodeForTokens(code);
    const profile = await googleAuth.fetchUserInfo(tokens.access_token);
    const user = users.findOrCreateFromGoogleProfile(profile);
    req.session.userId = user.id;
    res.redirect(next);
  } catch (err) {
    res.redirect(`${next}${next.includes("?") ? "&" : "?"}loginError=${encodeURIComponent(err.message)}`);
  }
});

router.post("/auth/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get("/auth/me", (req, res) => {
  const user = req.session && req.session.userId ? users.getUser(req.session.userId) : null;
  res.json({ user: users.publicUser(user), googleLoginEnabled: GOOGLE_LOGIN_ENABLED });
});

router.get("/me/communities", withUser((req, res) => {
  res.json(community.listCommunitiesForUser(req.session.userId));
}));

router.get("/me/games", withUser((req, res) => {
  res.json(community.listGamesForUser(req.session.userId));
}));

router.get("/sports", (req, res) => {
  res.json(SPORTS);
});

router.get("/events", (req, res) => {
  const events = db
    .all("events")
    .filter((e) => e.status !== "draft")
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(publicEvent);
  res.json(events);
});

router.get("/events/:id", (req, res) => {
  const event = db.find("events", req.params.id);
  if (!event || event.status === "draft") return res.status(404).json({ error: "Event not found" });
  res.json(publicEvent(event));
});

router.get("/events/:id/registrations", (req, res) => {
  const event = db.find("events", req.params.id);
  if (!event || event.status === "draft") return res.status(404).json({ error: "Event not found" });
  const regs = db
    .where("registrations", (r) => r.eventId === event.id && r.approved)
    .map(publicRegistration);
  res.json(regs);
});

router.post("/events/:id/register", (req, res) => {
  const event = db.find("events", req.params.id);
  if (!event || event.status === "draft") return res.status(404).json({ error: "Event not found" });
  if (event.status !== "registration_open") {
    return res.status(400).json({ error: "Registration is not open for this event." });
  }

  const sport = getSport(event.sport);
  const { name, members, contactName, contactEmail, contactPhone } = req.body || {};

  if (!name || !String(name).trim()) {
    return res.status(400).json({
      error: sport && sport.category === "individual" ? "Player name is required." : "Team name is required.",
    });
  }
  if (!contactName || !String(contactName).trim()) {
    return res.status(400).json({ error: "A contact name is required." });
  }
  if (!contactEmail && !contactPhone) {
    return res.status(400).json({ error: "Provide a contact email or phone number." });
  }

  const cleanMembers = Array.isArray(members)
    ? members.map((m) => String(m).trim()).filter(Boolean).slice(0, 50)
    : [];

  const duplicate = db.where(
    "registrations",
    (r) => r.eventId === event.id && r.name.toLowerCase() === String(name).trim().toLowerCase()
  );
  if (duplicate.length) {
    return res.status(400).json({
      error: `"${name}" is already registered for this event. Contact the organizer if this is a mistake.`,
    });
  }

  const record = db.insert("registrations", "registration", {
    eventId: event.id,
    name: String(name).trim(),
    members: cleanMembers,
    contactName: String(contactName).trim(),
    contactEmail: contactEmail ? String(contactEmail).trim() : "",
    contactPhone: contactPhone ? String(contactPhone).trim() : "",
    approved: true,
  });

  res.status(201).json(publicRegistration(record));
});

router.get("/events/:id/fixtures", (req, res) => {
  const event = db.find("events", req.params.id);
  if (!event || event.status === "draft") return res.status(404).json({ error: "Event not found" });
  const matches = matchService.eventMatches(event.id).map(publicMatch);
  res.json(matches);
});

router.get("/events/:id/standings", (req, res) => {
  const event = db.find("events", req.params.id);
  if (!event || event.status === "draft") return res.status(404).json({ error: "Event not found" });
  res.json({
    groups: matchService.groupStandings(event.id),
    overall: matchService.overallStandings(event.id),
  });
});

router.get("/events/:id/stats", (req, res) => {
  const event = db.find("events", req.params.id);
  if (!event || event.status === "draft") return res.status(404).json({ error: "Event not found" });
  res.json(matchService.eventStats(event.id));
});

router.get("/events/:id/players", (req, res) => {
  const event = db.find("events", req.params.id);
  if (!event || event.status === "draft") return res.status(404).json({ error: "Event not found" });
  res.json(matchService.playerProfiles(event.id));
});

router.get("/events/:id/suggest-format", (req, res) => {
  const event = db.find("events", req.params.id);
  if (!event || event.status === "draft") return res.status(404).json({ error: "Event not found" });
  const count = db.where("registrations", (r) => r.eventId === event.id && r.approved).length;
  res.json(suggestFormat(count, event.sport));
});

// ----- Match Days: casual/training sessions players join directly by name. -----

function serializeMatchday(md) {
  return { ...md, signupCount: db.where("matchdaySignups", (s) => s.matchdayId === md.id).length };
}

router.get("/matchdays", (req, res) => {
  const list = db
    .all("matchdays")
    .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0))
    .map(serializeMatchday);
  res.json(list);
});

router.get("/matchdays/:id", (req, res) => {
  const md = db.find("matchdays", req.params.id);
  if (!md) return res.status(404).json({ error: "Match day not found" });
  res.json(serializeMatchday(md));
});

router.get("/matchdays/:id/signups", (req, res) => {
  const md = db.find("matchdays", req.params.id);
  if (!md) return res.status(404).json({ error: "Match day not found" });
  const signups = db
    .where("matchdaySignups", (s) => s.matchdayId === md.id)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .map((s) => ({ id: s.id, name: s.name }));
  res.json(signups);
});

router.post("/matchdays/:id/join", (req, res) => {
  const md = db.find("matchdays", req.params.id);
  if (!md) return res.status(404).json({ error: "Match day not found" });
  if (md.status !== "open") return res.status(400).json({ error: "Signups are closed for this match day." });
  const { name } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: "Enter your name to join." });
  const trimmed = String(name).trim().slice(0, 60);
  const existing = db.where("matchdaySignups", (s) => s.matchdayId === md.id);
  if (existing.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
    return res.status(400).json({ error: `"${trimmed}" is already on the list.` });
  }
  if (existing.length >= md.maxPlayers) {
    return res.status(400).json({ error: `This match day is full (${md.maxPlayers}/${md.maxPlayers}). Ask the organizer about a waitlist.` });
  }
  const rec = db.insert("matchdaySignups", "player", { matchdayId: md.id, name: trimmed });
  res.status(201).json({ id: rec.id, name: rec.name });
});

// ----- Communities: clubs/groups with member lists and slot-based games.
// Anyone signed in can start their own community ("+ Start one") and
// becomes its host — distinct from the single site-admin dashboard, which
// can still manage (or take over) any community too. -----

// True if this request is allowed to manage the given community: either the
// signed-in user is that community's own host, or they're the site admin.
function canManageCommunity(req, existing) {
  if (req.session && req.session.isAdmin) return true;
  return !!(req.session && req.session.userId && existing.hostUserId === req.session.userId);
}

function withCommunityHost(paramKey, resolve) {
  return (req, res) => {
    const target = resolve(req);
    if (!target) return res.status(404).json({ error: "Not found" });
    if (!canManageCommunity(req, target.community)) {
      return res.status(403).json({ error: "Only this community's host or the site admin can do that." });
    }
    req._community = target.community;
    return target.handler(req, res);
  };
}

router.get("/communities", (req, res) => {
  res.json(community.listCommunities());
});

router.post("/communities", withUser((req, res) => {
  const { name } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: "Community name is required." });
  const me = users.getUser(req.session.userId);
  const created = community.createCommunity({ ...(req.body || {}), host: (req.body || {}).host || me.name }, me.id);
  try {
    community.addMember(created.id, me.name, me.id);
  } catch (e) {
    // already a member somehow — ignore
  }
  res.status(201).json(created);
}));

router.get("/communities/:id", (req, res) => {
  const c = community.getCommunity(req.params.id);
  if (!c) return res.status(404).json({ error: "Community not found" });
  res.json(c);
});

router.patch(
  "/communities/:id",
  withCommunityHost("id", (req) => {
    const existing = db.find("communities", req.params.id);
    if (!existing) return null;
    return {
      community: existing,
      handler: (req2, res2) => {
        const allowed = ["name", "sport", "host", "venue", "description", "status", "scheduleText", "pricePerGame"];
        const patch = {};
        for (const key of allowed) {
          if (key in (req2.body || {})) patch[key] = req2.body[key];
        }
        if (patch.status && !["open", "closed"].includes(patch.status)) {
          return res2.status(400).json({ error: "Invalid status." });
        }
        res2.json(community.updateCommunity(existing.id, patch));
      },
    };
  })
);

router.delete(
  "/communities/:id",
  withCommunityHost("id", (req) => {
    const existing = db.find("communities", req.params.id);
    if (!existing) return null;
    return {
      community: existing,
      handler: (req2, res2) => {
        community.deleteCommunity(existing.id);
        res2.json({ ok: true });
      },
    };
  })
);

router.get("/communities/:id/members", (req, res) => {
  const existing = db.find("communities", req.params.id);
  if (!existing) return res.status(404).json({ error: "Community not found" });
  res.json(community.listMembers(existing.id).map((m) => ({ id: m.id, name: m.name })));
});

router.delete(
  "/community-members/:id",
  withCommunityHost("id", (req) => {
    const member = db.find("communityMembers", req.params.id);
    if (!member) return null;
    const existing = db.find("communities", member.communityId);
    if (!existing) return null;
    return {
      community: existing,
      handler: (req2, res2) => {
        community.removeMember(member.id);
        res2.json({ ok: true });
      },
    };
  })
);

router.post("/communities/:id/join", withUser((req, res) => {
  const existing = db.find("communities", req.params.id);
  if (!existing) return res.status(404).json({ error: "Community not found" });
  if (existing.status !== "open") return res.status(400).json({ error: "This community isn't open to new members right now." });
  try {
    const me = users.getUser(req.session.userId);
    const m = community.addMember(existing.id, me.name, me.id);
    res.status(201).json({ id: m.id, name: m.name });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
}));

router.get("/communities/:id/games", (req, res) => {
  const existing = db.find("communities", req.params.id);
  if (!existing) return res.status(404).json({ error: "Community not found" });
  res.json(community.listGames(existing.id));
});

router.post(
  "/communities/:id/games",
  withCommunityHost("id", (req) => {
    const existing = db.find("communities", req.params.id);
    if (!existing) return null;
    return {
      community: existing,
      handler: (req2, res2) => {
        try {
          res2.status(201).json(community.createGame(existing.id, req2.body || {}));
        } catch (err) {
          res2.status(err.status || 400).json({ error: err.message });
        }
      },
    };
  })
);

router.get("/community-games/:id", (req, res) => {
  const g = community.getGame(req.params.id);
  if (!g) return res.status(404).json({ error: "Game not found" });
  res.json(g);
});

router.patch(
  "/community-games/:id",
  withCommunityHost("id", (req) => {
    const game = db.find("communityGames", req.params.id);
    if (!game) return null;
    const existing = db.find("communities", game.communityId);
    if (!existing) return null;
    return {
      community: existing,
      handler: (req2, res2) => {
        const allowed = ["title", "venue", "date", "time", "durationMins", "entryFee", "originalFee", "friendly", "notes", "status"];
        const patch = {};
        for (const key of allowed) {
          if (key in (req2.body || {})) patch[key] = req2.body[key];
        }
        if (patch.status && !["open", "closed", "completed"].includes(patch.status)) {
          return res2.status(400).json({ error: "Invalid status." });
        }
        res2.json(community.updateGame(game.id, patch));
      },
    };
  })
);

router.delete(
  "/community-games/:id",
  withCommunityHost("id", (req) => {
    const game = db.find("communityGames", req.params.id);
    if (!game) return null;
    const existing = db.find("communities", game.communityId);
    if (!existing) return null;
    return {
      community: existing,
      handler: (req2, res2) => {
        community.deleteGame(game.id);
        res2.json({ ok: true });
      },
    };
  })
);

router.patch(
  "/community-slots/:id",
  withCommunityHost("id", (req) => {
    const slot = db.find("communityGameSlots", req.params.id);
    if (!slot) return null;
    const game = db.find("communityGames", slot.gameId);
    const existing = game ? db.find("communities", game.communityId) : null;
    if (!existing) return null;
    return {
      community: existing,
      handler: (req2, res2) => {
        const name = (req2.body || {}).name;
        if (!name || !String(name).trim()) return res2.status(400).json({ error: "Name is required." });
        res2.json(db.update("communityGameSlots", slot.id, { playerName: String(name).trim().slice(0, 60), userId: null }));
      },
    };
  })
);

router.delete(
  "/community-slots/:id",
  withCommunityHost("id", (req) => {
    const slot = db.find("communityGameSlots", req.params.id);
    if (!slot) return null;
    const game = db.find("communityGames", slot.gameId);
    const existing = game ? db.find("communities", game.communityId) : null;
    if (!existing) return null;
    return {
      community: existing,
      handler: (req2, res2) => {
        res2.json(community.clearSlot(slot.id));
      },
    };
  })
);

router.post("/community-games/:id/slots/:slotId/claim", withUser((req, res) => {
  try {
    const me = users.getUser(req.session.userId);
    const slot = community.claimSlot(req.params.id, req.params.slotId, me.name, me.id);
    res.json(slot);
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
}));

module.exports = router;
