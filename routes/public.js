const { Router } = require("../lib/miniweb");
const db = require("../lib/db");
const { getSport, SPORTS } = require("../lib/sports");
const { suggestFormat } = require("../lib/fixtures");
const matchService = require("../lib/matchService");
const { publicEvent, publicRegistration, publicMatch } = require("../lib/serialize");

const router = new Router();

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

module.exports = router;
