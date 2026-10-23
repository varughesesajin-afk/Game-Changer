const db = require("./db");
const { getSport } = require("./sports");

function registrationCount(eventId) {
  return db.where("registrations", (r) => r.eventId === eventId && r.approved).length;
}

function publicEvent(event) {
  const sport = getSport(event.sport);
  return {
    id: event.id,
    name: event.name,
    sport: event.sport,
    sportLabel: sport ? sport.label : event.sport,
    category: sport ? sport.category : "team",
    description: event.description || "",
    venue: event.venue || "",
    startDate: event.startDate || null,
    regDeadline: event.regDeadline || null,
    status: event.status,
    format: event.format || null,
    registrationCount: registrationCount(event.id),
  };
}

function publicRegistration(r) {
  return {
    id: r.id,
    name: r.name,
    members: r.members || [],
  };
}

function adminRegistration(r) {
  return r;
}

function publicMatch(m) {
  return {
    id: m.id,
    stage: m.stage,
    groupName: m.groupName,
    round: m.round,
    roundName: m.roundName,
    matchNumber: m.matchNumber,
    participantAName: m.participantAName,
    participantBName: m.participantBName,
    scoreA: m.scoreA,
    scoreB: m.scoreB,
    games: m.games || null,
    penalties: m.penalties || null,
    goalEvents: m.goalEvents || [],
    status: m.status,
    winnerName: m.winnerName,
    scheduledAt: m.scheduledAt,
    venue: m.venue,
  };
}

module.exports = { publicEvent, publicRegistration, adminRegistration, publicMatch, registrationCount };
