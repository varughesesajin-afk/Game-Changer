const { Router } = require("../lib/miniweb");
const db = require("../lib/db");
const { getSport } = require("../lib/sports");
const { suggestFormat, shuffle } = require("../lib/fixtures");
const matchService = require("../lib/matchService");
const { ADMIN_PASSWORD } = require("../lib/config");

const router = new Router();

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.status(401).json({ error: "Admin login required." });
}

router.post("/login", (req, res) => {
  const { password } = req.body || {};
  if (password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.json({ isAdmin: true });
  }
  return res.status(401).json({ error: "Incorrect password." });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ isAdmin: false }));
});

router.get("/session", (req, res) => {
  res.json({ isAdmin: !!(req.session && req.session.isAdmin) });
});

router.use(requireAdmin);

router.get("/events", (req, res) => {
  const events = db.all("events").sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const withCounts = events.map((e) => ({
    ...e,
    registrationCount: db.where("registrations", (r) => r.eventId === e.id && r.approved).length,
  }));
  res.json(withCounts);
});

router.post("/events", (req, res) => {
  const { name, sport, description, venue, startDate, regDeadline } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: "Event name is required." });
  if (!getSport(sport)) return res.status(400).json({ error: "Unknown sport." });

  const event = db.insert("events", "event", {
    name: String(name).trim(),
    sport,
    description: description ? String(description).trim() : "",
    venue: venue ? String(venue).trim() : "",
    startDate: startDate || null,
    regDeadline: regDeadline || null,
    status: "registration_open",
    format: null,
  });
  res.status(201).json(event);
});

router.get("/events/:id", (req, res) => {
  const event = db.find("events", req.params.id);
  if (!event) return res.status(404).json({ error: "Event not found" });
  res.json(event);
});

router.patch("/events/:id", (req, res) => {
  const event = db.find("events", req.params.id);
  if (!event) return res.status(404).json({ error: "Event not found" });

  const allowed = ["name", "description", "venue", "startDate", "regDeadline", "status"];
  const patch = {};
  for (const key of allowed) {
    if (key in (req.body || {})) patch[key] = req.body[key];
  }
  const validStatuses = [
    "draft",
    "registration_open",
    "registration_closed",
    "fixtures_set",
    "in_progress",
    "completed",
  ];
  if (patch.status && !validStatuses.includes(patch.status)) {
    return res.status(400).json({ error: "Invalid status." });
  }
  const updated = db.update("events", event.id, patch);
  res.json(updated);
});

router.delete("/events/:id", (req, res) => {
  const event = db.find("events", req.params.id);
  if (!event) return res.status(404).json({ error: "Event not found" });
  db.remove("events", event.id);
  db.removeWhere("registrations", (r) => r.eventId === event.id);
  db.removeWhere("matches", (m) => m.eventId === event.id);
  res.json({ ok: true });
});

router.get("/events/:id/registrations", (req, res) => {
  const event = db.find("events", req.params.id);
  if (!event) return res.status(404).json({ error: "Event not found" });
  res.json(db.where("registrations", (r) => r.eventId === event.id));
});

router.post("/events/:id/registrations", (req, res) => {
  const event = db.find("events", req.params.id);
  if (!event) return res.status(404).json({ error: "Event not found" });
  const { name, members, contactName, contactEmail, contactPhone } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: "Name is required." });

  const record = db.insert("registrations", "registration", {
    eventId: event.id,
    name: String(name).trim(),
    members: Array.isArray(members) ? members.map(String) : [],
    contactName: contactName ? String(contactName).trim() : "",
    contactEmail: contactEmail ? String(contactEmail).trim() : "",
    contactPhone: contactPhone ? String(contactPhone).trim() : "",
    approved: true,
  });
  res.status(201).json(record);
});

router.patch("/registrations/:id", (req, res) => {
  const reg = db.find("registrations", req.params.id);
  if (!reg) return res.status(404).json({ error: "Registration not found" });
  const allowed = ["name", "members", "contactName", "contactEmail", "contactPhone", "approved"];
  const patch = {};
  for (const key of allowed) {
    if (key in (req.body || {})) patch[key] = req.body[key];
  }
  res.json(db.update("registrations", reg.id, patch));
});

router.delete("/registrations/:id", (req, res) => {
  const reg = db.find("registrations", req.params.id);
  if (!reg) return res.status(404).json({ error: "Registration not found" });
  const hasMatches = db.where(
    "matches",
    (m) => m.eventId === reg.eventId && (m.participantAId === reg.id || m.participantBId === reg.id)
  ).length;
  if (hasMatches) {
    return res.status(400).json({
      error: "This entry already has fixtures generated. Remove/regenerate fixtures first.",
    });
  }
  db.remove("registrations", reg.id);
  res.json({ ok: true });
});

router.get("/events/:id/suggest-format", (req, res) => {
  const event = db.find("events", req.params.id);
  if (!event) return res.status(404).json({ error: "Event not found" });
  const count = db.where("registrations", (r) => r.eventId === event.id && r.approved).length;
  res.json(suggestFormat(count, event.sport));
});

router.post("/events/:id/generate-fixtures", (req, res) => {
  const event = db.find("events", req.params.id);
  if (!event) return res.status(404).json({ error: "Event not found" });
  const { format } = req.body || {};
  if (!["round_robin", "knockout", "group_knockout"].includes(format)) {
    return res.status(400).json({ error: "format must be round_robin, knockout, or group_knockout." });
  }
  const regs = db.where("registrations", (r) => r.eventId === event.id && r.approved);
  if (regs.length < 2) {
    return res.status(400).json({ error: "Need at least 2 registered entries to generate fixtures." });
  }
  const participants = regs.map((r) => ({ id: r.id, name: r.name }));

  try {
    if (format === "round_robin") {
      matchService.createRoundRobin(event.id, participants);
    } else if (format === "knockout") {
      matchService.clearEventMatches(event.id);
      matchService.createKnockout(event.id, shuffle(participants));
    } else if (format === "group_knockout") {
      matchService.createGroupStage(event.id, participants);
    }
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  db.update("events", event.id, { format, status: "fixtures_set" });
  res.json({ ok: true, matches: matchService.eventMatches(event.id) });
});

router.post("/events/:id/generate-knockout-from-groups", (req, res) => {
  const event = db.find("events", req.params.id);
  if (!event) return res.status(404).json({ error: "Event not found" });
  const advancePerGroup = Number(req.body && req.body.advancePerGroup) || 2;
  try {
    matchService.createKnockoutFromGroups(event.id, advancePerGroup);
    db.update("events", event.id, { status: "in_progress", advancePerGroup });
    res.json({ ok: true, matches: matchService.eventMatches(event.id) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/events/:id/matches", (req, res) => {
  const event = db.find("events", req.params.id);
  if (!event) return res.status(404).json({ error: "Event not found" });
  res.json(matchService.eventMatches(event.id));
});

router.get("/events/:id/standings", (req, res) => {
  const event = db.find("events", req.params.id);
  if (!event) return res.status(404).json({ error: "Event not found" });
  res.json({
    groups: matchService.groupStandings(event.id),
    overall: matchService.overallStandings(event.id),
  });
});

router.get("/events/:id/stats", (req, res) => {
  const event = db.find("events", req.params.id);
  if (!event) return res.status(404).json({ error: "Event not found" });
  res.json(matchService.eventStats(event.id));
});

router.get("/events/:id/players", (req, res) => {
  const event = db.find("events", req.params.id);
  if (!event) return res.status(404).json({ error: "Event not found" });
  res.json(matchService.playerProfiles(event.id));
});

router.patch("/matches/:id", (req, res) => {
  const match = db.find("matches", req.params.id);
  if (!match) return res.status(404).json({ error: "Match not found" });

  const { scoreA, scoreB, games, penalties, goalEvents, potm, scheduledAt, venue } = req.body || {};
  let result = match;

  if (scheduledAt !== undefined || venue !== undefined) {
    const patch = {};
    if (scheduledAt !== undefined) patch.scheduledAt = scheduledAt;
    if (venue !== undefined) patch.venue = venue;
    result = db.update("matches", match.id, patch);
  }

  if (goalEvents !== undefined) {
    try {
      result = matchService.recordGoalEvents(match.id, goalEvents);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }

  if (potm !== undefined) {
    try {
      result = matchService.recordPotm(match.id, potm);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }

  if (penalties !== undefined) {
    try {
      result = matchService.recordPenalties(match.id, penalties);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  } else if (games !== undefined) {
    try {
      result = matchService.recordGameScores(match.id, games);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  } else if (scoreA !== undefined && scoreB !== undefined) {
    const a = Number(scoreA);
    const b = Number(scoreB);
    if (Number.isNaN(a) || Number.isNaN(b) || a < 0 || b < 0) {
      return res.status(400).json({ error: "Scores must be non-negative numbers." });
    }
    try {
      result = matchService.recordScore(match.id, a, b);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }

  res.json(result);
});

router.delete("/matches/:id/score", (req, res) => {
  const match = db.find("matches", req.params.id);
  if (!match) return res.status(404).json({ error: "Match not found" });
  res.json(matchService.clearScore(match.id));
});

// ----- Match Days: casual/training sessions with a simple player signup
// list (no teams, no fixtures) — just a capped roster plus when/where. -----

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

router.post("/matchdays", (req, res) => {
  const { name, venue, date, time, maxPlayers, notes } = req.body || {};
  const max = Number(maxPlayers);
  if (!Number.isInteger(max) || max < 2 || max > 200) {
    return res.status(400).json({ error: "Max players must be a whole number between 2 and 200." });
  }
  if (!date) return res.status(400).json({ error: "Date is required." });
  const md = db.insert("matchdays", "mday", {
    name: name ? String(name).trim().slice(0, 100) : "",
    venue: venue ? String(venue).trim().slice(0, 120) : "",
    date,
    time: time ? String(time).trim() : "",
    maxPlayers: max,
    notes: notes ? String(notes).trim().slice(0, 300) : "",
    status: "open",
  });
  res.status(201).json(serializeMatchday(md));
});

router.get("/matchdays/:id", (req, res) => {
  const md = db.find("matchdays", req.params.id);
  if (!md) return res.status(404).json({ error: "Match day not found" });
  res.json(serializeMatchday(md));
});

router.patch("/matchdays/:id", (req, res) => {
  const md = db.find("matchdays", req.params.id);
  if (!md) return res.status(404).json({ error: "Match day not found" });
  const allowed = ["name", "venue", "date", "time", "notes", "status"];
  const patch = {};
  for (const key of allowed) {
    if (key in (req.body || {})) patch[key] = req.body[key];
  }
  if (patch.status && !["open", "closed"].includes(patch.status)) {
    return res.status(400).json({ error: "Invalid status." });
  }
  if ("maxPlayers" in (req.body || {})) {
    const max = Number(req.body.maxPlayers);
    if (!Number.isInteger(max) || max < 2 || max > 200) {
      return res.status(400).json({ error: "Max players must be a whole number between 2 and 200." });
    }
    patch.maxPlayers = max;
  }
  res.json(serializeMatchday(db.update("matchdays", md.id, patch)));
});

router.delete("/matchdays/:id", (req, res) => {
  const md = db.find("matchdays", req.params.id);
  if (!md) return res.status(404).json({ error: "Match day not found" });
  db.remove("matchdays", md.id);
  db.removeWhere("matchdaySignups", (s) => s.matchdayId === md.id);
  res.json({ ok: true });
});

router.get("/matchdays/:id/signups", (req, res) => {
  const md = db.find("matchdays", req.params.id);
  if (!md) return res.status(404).json({ error: "Match day not found" });
  const signups = db
    .where("matchdaySignups", (s) => s.matchdayId === md.id)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  res.json(signups);
});

router.post("/matchdays/:id/signups", (req, res) => {
  const md = db.find("matchdays", req.params.id);
  if (!md) return res.status(404).json({ error: "Match day not found" });
  const { name } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: "Name is required." });
  const trimmed = String(name).trim().slice(0, 60);
  const existing = db.where("matchdaySignups", (s) => s.matchdayId === md.id);
  if (existing.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
    return res.status(400).json({ error: `"${trimmed}" is already on the list.` });
  }
  if (existing.length >= md.maxPlayers) {
    return res.status(400).json({ error: `This match day is full (${md.maxPlayers}/${md.maxPlayers}).` });
  }
  const rec = db.insert("matchdaySignups", "player", { matchdayId: md.id, name: trimmed });
  res.status(201).json(rec);
});

router.delete("/signups/:id", (req, res) => {
  const s = db.find("matchdaySignups", req.params.id);
  if (!s) return res.status(404).json({ error: "Signup not found" });
  db.remove("matchdaySignups", s.id);
  res.json({ ok: true });
});

module.exports = router;
