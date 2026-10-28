const db = require("./db");
const { getSport } = require("./sports");

// ----- Communities: clubs/groups the organizer runs. Members join by name
// (no accounts, same lightweight model as Match Days). Each community can
// host "community games" — slot-based sessions where individual players
// claim an open seat on Team A or Team B instead of a whole team
// registering at once. -----

function serializeCommunity(c) {
  const sport = getSport(c.sport);
  const memberCount = db.where("communityMembers", (m) => m.communityId === c.id).length;
  const games = db.where("communityGames", (g) => g.communityId === c.id);
  const upcomingGamesCount = games.filter((g) => g.status === "open").length;
  return {
    ...c,
    sportLabel: sport ? sport.label : c.sport || "",
    memberCount,
    upcomingGamesCount,
  };
}

function listCommunities() {
  return db.all("communities").map(serializeCommunity);
}

function getCommunity(id) {
  const c = db.find("communities", id);
  return c ? serializeCommunity(c) : null;
}

function createCommunity(data) {
  const c = db.insert("communities", "community", {
    name: String(data.name || "").trim().slice(0, 100),
    sport: data.sport || "",
    host: data.host ? String(data.host).trim().slice(0, 80) : "",
    venue: data.venue ? String(data.venue).trim().slice(0, 120) : "",
    description: data.description ? String(data.description).trim().slice(0, 500) : "",
    status: "open",
  });
  return serializeCommunity(c);
}

function updateCommunity(id, patch) {
  const updated = db.update("communities", id, patch);
  return updated ? serializeCommunity(updated) : null;
}

function deleteCommunity(id) {
  const gameIds = db.where("communityGames", (g) => g.communityId === id).map((g) => g.id);
  db.remove("communities", id);
  db.removeWhere("communityMembers", (m) => m.communityId === id);
  db.removeWhere("communityGames", (g) => g.communityId === id);
  db.removeWhere("communityGameSlots", (s) => gameIds.includes(s.gameId));
}

function listMembers(communityId) {
  return db
    .where("communityMembers", (m) => m.communityId === communityId)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

function addMember(communityId, name) {
  const trimmed = String(name || "").trim().slice(0, 60);
  if (!trimmed) throw httpError(400, "Name is required.");
  const existing = listMembers(communityId);
  if (existing.some((m) => m.name.toLowerCase() === trimmed.toLowerCase())) {
    throw httpError(400, `"${trimmed}" is already a member.`);
  }
  return db.insert("communityMembers", "cmember", { communityId, name: trimmed });
}

function removeMember(memberId) {
  return db.remove("communityMembers", memberId);
}

// ----- Community games: slot-based sessions -----

function serializeGame(g) {
  const sport = getSport(g.sport);
  const slots = db
    .where("communityGameSlots", (s) => s.gameId === g.id)
    .sort((a, b) => (a.team === b.team ? a.slotIndex - b.slotIndex : a.team.localeCompare(b.team)));
  const filled = slots.filter((s) => s.playerName).length;
  return {
    ...g,
    sportLabel: sport ? sport.label : g.sport || "",
    totalSlots: slots.length,
    filledSlots: filled,
    slots,
  };
}

function listGames(communityId) {
  return db
    .where("communityGames", (g) => g.communityId === communityId)
    .sort((a, b) => new Date(`${a.date}T${a.time || "00:00"}`) - new Date(`${b.date}T${b.time || "00:00"}`))
    .map(serializeGame);
}

function getGame(id) {
  const g = db.find("communityGames", id);
  return g ? serializeGame(g) : null;
}

function createGame(communityId, data) {
  const teamSize = Number(data.teamSize);
  if (!Number.isInteger(teamSize) || teamSize < 1 || teamSize > 11) {
    throw httpError(400, "Players per team must be a whole number between 1 and 11.");
  }
  if (!data.date) throw httpError(400, "Date is required.");
  const entryFee = data.entryFee === "" || data.entryFee == null ? 0 : Number(data.entryFee);
  if (Number.isNaN(entryFee) || entryFee < 0) throw httpError(400, "Entry fee must be a non-negative number.");
  const originalFee =
    data.originalFee === "" || data.originalFee == null ? null : Number(data.originalFee);
  if (originalFee != null && (Number.isNaN(originalFee) || originalFee < 0)) {
    throw httpError(400, "Original fee must be a non-negative number.");
  }

  const game = db.insert("communityGames", "cgame", {
    communityId,
    sport: data.sport || "",
    title: data.title ? String(data.title).trim().slice(0, 100) : "",
    venue: data.venue ? String(data.venue).trim().slice(0, 120) : "",
    date: data.date,
    time: data.time ? String(data.time).trim() : "",
    durationMins: Number(data.durationMins) || 90,
    teamSize,
    entryFee,
    originalFee,
    friendly: !!data.friendly,
    notes: data.notes ? String(data.notes).trim().slice(0, 300) : "",
    status: "open",
  });

  const slots = [];
  for (const team of ["A", "B"]) {
    for (let i = 1; i <= teamSize; i++) {
      slots.push({ gameId: game.id, team, slotIndex: i, playerName: null });
    }
  }
  db.insertMany("communityGameSlots", "cslot", slots);

  return serializeGame(game);
}

function updateGame(id, patch) {
  const updated = db.update("communityGames", id, patch);
  return updated ? serializeGame(updated) : null;
}

function deleteGame(id) {
  db.remove("communityGames", id);
  db.removeWhere("communityGameSlots", (s) => s.gameId === id);
}

function claimSlot(gameId, slotId, name) {
  const game = db.find("communityGames", gameId);
  if (!game) throw httpError(404, "Game not found.");
  if (game.status !== "open") throw httpError(400, "This game is no longer open to joins.");
  const slot = db.find("communityGameSlots", slotId);
  if (!slot || slot.gameId !== gameId) throw httpError(404, "Slot not found.");
  if (slot.playerName) throw httpError(400, "That spot is already taken.");
  const trimmed = String(name || "").trim().slice(0, 60);
  if (!trimmed) throw httpError(400, "Name is required.");
  const gameSlots = db.where("communityGameSlots", (s) => s.gameId === gameId);
  if (gameSlots.some((s) => s.playerName && s.playerName.toLowerCase() === trimmed.toLowerCase())) {
    throw httpError(400, `"${trimmed}" already has a spot in this game.`);
  }
  return db.update("communityGameSlots", slotId, { playerName: trimmed });
}

function clearSlot(slotId) {
  return db.update("communityGameSlots", slotId, { playerName: null });
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

module.exports = {
  serializeCommunity,
  listCommunities,
  getCommunity,
  createCommunity,
  updateCommunity,
  deleteCommunity,
  listMembers,
  addMember,
  removeMember,
  serializeGame,
  listGames,
  getGame,
  createGame,
  updateGame,
  deleteGame,
  claimSlot,
  clearSlot,
  httpError,
};
