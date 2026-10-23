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

router.get("/events/:id/suggest-format", (req, res) => {
  const event = db.find("events", req.params.id);
  if (!event || event.status === "draft") return res.status(404).json({ error: "Event not found" });
  const count = db.where("registrations", (r) => r.eventId === event.id && r.approved).length;
  res.json(suggestFormat(count, event.sport));
});

module.exports = router;
