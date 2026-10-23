const db = require("./db");
const fixtures = require("./fixtures");
const { computeStandings } = require("./standings");
const { getSport } = require("./sports");

function roundNames(totalRounds) {
  const names = [];
  for (let r = 0; r < totalRounds; r++) {
    const fromEnd = totalRounds - r;
    if (fromEnd === 1) names.push("Final");
    else if (fromEnd === 2) names.push("Semifinal");
    else if (fromEnd === 3) names.push("Quarterfinal");
    else names.push(`Round ${r + 1}`);
  }
  return names;
}

function clearEventMatches(eventId) {
  db.removeWhere("matches", (m) => m.eventId === eventId);
}

function baseMatchFields(eventId) {
  return {
    eventId,
    scoreA: null,
    scoreB: null,
    games: null,
    penalties: null,
    goalEvents: [],
    winnerId: null,
    winnerName: null,
    scheduledAt: null,
    venue: null,
    nextMatchId: null,
    nextSlot: null,
  };
}

function createRoundRobin(eventId, participants) {
  clearEventMatches(eventId);
  const rounds = fixtures.roundRobinSchedule(participants);
  let matchNumber = 1;
  const records = [];
  rounds.forEach((pairs, ri) => {
    pairs.forEach(([a, b]) => {
      records.push({
        ...baseMatchFields(eventId),
        stage: "round_robin",
        groupName: null,
        round: ri + 1,
        roundName: `Round ${ri + 1}`,
        matchNumber: matchNumber++,
        participantAId: a.id,
        participantAName: a.name,
        participantBId: b.id,
        participantBName: b.name,
        status: "scheduled",
      });
    });
  });
  return db.insertMany("matches", "match", records);
}

function createGroupStage(eventId, participants) {
  clearEventMatches(eventId);
  const groups = fixtures.splitIntoGroups(participants);
  let matchNumber = 1;
  const records = [];
  groups.forEach((group) => {
    const rounds = fixtures.roundRobinSchedule(group.members);
    rounds.forEach((pairs, ri) => {
      pairs.forEach(([a, b]) => {
        records.push({
          ...baseMatchFields(eventId),
          stage: "group",
          groupName: group.name,
          round: ri + 1,
          roundName: `${group.name} · Round ${ri + 1}`,
          matchNumber: matchNumber++,
          participantAId: a.id,
          participantAName: a.name,
          participantBId: b.id,
          participantBName: b.name,
          status: "scheduled",
        });
      });
    });
  });
  db.insertMany("matches", "match", records);
  return groups.map((g) => ({ name: g.name, members: g.members }));
}

function createKnockout(eventId, participants, stage = "knockout", startingMatchNumber = 1) {
  const { rounds } = fixtures.knockoutBracket(participants);
  const names = roundNames(rounds.length);
  let matchNumber = startingMatchNumber;
  const createdRounds = [];

  for (let r = 0; r < rounds.length; r++) {
    const roundMatches = rounds[r];
    const toInsert = roundMatches.map((m) => {
      const hasA = r === 0 && m.slotA;
      const hasB = r === 0 && m.slotB;
      let status = "pending";
      if (r === 0) status = hasA && hasB ? "scheduled" : "bye";
      return {
        ...baseMatchFields(eventId),
        stage,
        groupName: null,
        round: r + 1,
        roundName: names[r],
        matchNumber: matchNumber++,
        participantAId: hasA ? m.slotA.id : null,
        participantAName: hasA ? m.slotA.name : null,
        participantBId: hasB ? m.slotB.id : null,
        participantBName: hasB ? m.slotB.name : null,
        status,
      };
    });
    createdRounds.push(db.insertMany("matches", "match", toInsert));
  }

  for (let r = 0; r < createdRounds.length - 1; r++) {
    createdRounds[r].forEach((match, i) => {
      const nextMatch = createdRounds[r + 1][Math.floor(i / 2)];
      const nextSlot = i % 2 === 0 ? "A" : "B";
      db.update("matches", match.id, { nextMatchId: nextMatch.id, nextSlot });
    });
  }

  const freshRound1 = db.where(
    "matches",
    (m) => m.eventId === eventId && m.stage === stage && m.round === 1
  );
  freshRound1.forEach((match) => {
    if (match.status === "bye") {
      const winnerId = match.participantAId || match.participantBId;
      const winnerName = match.participantAName || match.participantBName;
      const updated = db.update("matches", match.id, { winnerId, winnerName });
      if (updated.nextMatchId) propagateWinner(updated);
    }
  });

  return matchNumber;
}

function propagateWinner(match) {
  if (!match.nextMatchId || !match.winnerId) return;
  const next = db.find("matches", match.nextMatchId);
  if (!next) return;
  const patch =
    match.nextSlot === "A"
      ? { participantAId: match.winnerId, participantAName: match.winnerName }
      : { participantBId: match.winnerId, participantBName: match.winnerName };
  const updatedNext = db.update("matches", next.id, patch);
  if (updatedNext.participantAId && updatedNext.participantBId && updatedNext.status === "pending") {
    db.update("matches", next.id, { status: "scheduled" });
  }
}

function recordScore(matchId, scoreA, scoreB) {
  const match = db.find("matches", matchId);
  if (!match) return null;
  if (!match.participantAId || !match.participantBId) {
    throw new Error("Both participants must be set before recording a score.");
  }
  if (matchScoringConfig(match)) {
    throw new Error("This sport is scored game by game, not as a single score.");
  }
  let winnerId = null;
  let winnerName = null;
  if (scoreA > scoreB) {
    winnerId = match.participantAId;
    winnerName = match.participantAName;
  } else if (scoreB > scoreA) {
    winnerId = match.participantBId;
    winnerName = match.participantBName;
  }
  const updated = db.update("matches", matchId, {
    scoreA,
    scoreB,
    status: "completed",
    penalties: null,
    winnerId,
    winnerName,
  });
  if (updated.nextMatchId && winnerId) propagateWinner(updated);
  return updated;
}

function clearScore(matchId) {
  const match = db.find("matches", matchId);
  if (!match) return null;
  return db.update("matches", matchId, {
    scoreA: null,
    scoreB: null,
    games: null,
    penalties: null,
    goalEvents: [],
    status: match.participantAId && match.participantBId ? "scheduled" : "pending",
    winnerId: null,
    winnerName: null,
  });
}

// Optional per-goal detail (who scored, who assisted) for sports where that's
// tracked. Independent of the scoreline itself — stats (top scorers, assists)
// are computed from these across the whole event.
function recordGoalEvents(matchId, rawEvents) {
  const match = db.find("matches", matchId);
  if (!match) return null;
  if (!match.participantAId || !match.participantBId) {
    throw new Error("Both participants must be set before recording goals.");
  }
  const events = (rawEvents || [])
    .filter((e) => e && typeof e === "object" && String(e.scorer || "").trim())
    .map((e) => ({
      side: e.side === "B" ? "B" : "A",
      scorer: String(e.scorer).trim().slice(0, 60),
      assist: e.assist != null && String(e.assist).trim() ? String(e.assist).trim().slice(0, 60) : "",
    }));
  return db.update("matches", matchId, { goalEvents: events });
}

// Knockout matches must produce a winner. When regulation (or games, for a
// games-scored sport) ends level, organizers record a penalty shootout —
// each kick has a taker name, shirt number, and whether it was scored — and
// the shootout alone decides who advances; the drawn scoreline is kept as-is.
function recordPenalties(matchId, rawShots) {
  const match = db.find("matches", matchId);
  if (!match) return null;
  if (match.stage !== "knockout") {
    throw new Error("Penalty shootouts only apply to knockout matches.");
  }
  if (match.scoreA == null || match.scoreB == null || match.scoreA !== match.scoreB) {
    throw new Error("Penalties can only be recorded once the match has ended level.");
  }

  const shots = (rawShots || [])
    .filter((s) => s && typeof s === "object" && String(s.name || "").trim())
    .map((s) => ({
      side: s.side === "B" ? "B" : "A",
      name: String(s.name).trim().slice(0, 60),
      number: s.number != null ? String(s.number).trim().slice(0, 10) : "",
      scored: !!s.scored,
    }));
  if (!shots.length) {
    throw new Error("Enter at least one penalty kick (name + whether it was scored).");
  }

  let scoreA = 0;
  let scoreB = 0;
  shots.forEach((s) => {
    if (!s.scored) return;
    if (s.side === "A") scoreA++;
    else scoreB++;
  });
  if (scoreA === scoreB) {
    throw new Error("The shootout is still level — add sudden-death kicks until one side is ahead.");
  }

  const winnerId = scoreA > scoreB ? match.participantAId : match.participantBId;
  const winnerName = scoreA > scoreB ? match.participantAName : match.participantBName;
  const updated = db.update("matches", matchId, {
    penalties: { shots, scoreA, scoreB },
    winnerId,
    winnerName,
  });
  if (updated.nextMatchId) propagateWinner(updated);
  return updated;
}

// Sports like badminton are decided over several games to a fixed point
// target (e.g. best of 3 games to 21, win by 2, capped at 30), not by a
// single cumulative score. This validates each game and tallies games won
// rather than points, so the winner reflects who actually won the match.
function matchScoringConfig(match) {
  const event = db.find("events", match.eventId);
  const sport = event && getSport(event.sport);
  return sport && sport.scoring && sport.scoring.type === "games" ? sport.scoring : null;
}

function validateGame(a, b, config, gameNumber) {
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isInteger(na) || !Number.isInteger(nb) || na < 0 || nb < 0) {
    throw new Error(`Game ${gameNumber}: scores must be non-negative whole numbers.`);
  }
  if (na === nb) {
    throw new Error(`Game ${gameNumber}: can't end in a tie.`);
  }
  const winningScore = Math.max(na, nb);
  const losingScore = Math.min(na, nb);
  if (winningScore > config.cap) {
    throw new Error(`Game ${gameNumber}: score can't exceed ${config.cap}.`);
  }
  if (winningScore < config.pointsToWin) {
    throw new Error(`Game ${gameNumber}: not decided yet — a side needs at least ${config.pointsToWin} points.`);
  }
  const wonAtCap = winningScore === config.cap;
  if (!wonAtCap && winningScore - losingScore < config.winBy) {
    throw new Error(`Game ${gameNumber}: must be won by ${config.winBy} points, or reach ${config.cap}.`);
  }
  return [na, nb];
}

function recordGameScores(matchId, rawGames) {
  const match = db.find("matches", matchId);
  if (!match) return null;
  if (!match.participantAId || !match.participantBId) {
    throw new Error("Both participants must be set before recording a score.");
  }
  const config = matchScoringConfig(match);
  if (!config) {
    throw new Error("This sport doesn't use game-by-game scoring.");
  }

  const entries = (rawGames || []).filter(
    (g) => Array.isArray(g) && g[0] !== "" && g[1] !== "" && g[0] != null && g[1] != null
  );
  if (!entries.length) {
    throw new Error("Enter at least one completed game.");
  }
  if (entries.length > config.bestOf) {
    throw new Error(`Best of ${config.bestOf} — that's more games than this match can have.`);
  }

  const needed = Math.ceil(config.bestOf / 2);
  const games = [];
  let gamesA = 0;
  let gamesB = 0;
  for (let i = 0; i < entries.length; i++) {
    const [a, b] = validateGame(entries[i][0], entries[i][1], config, i + 1);
    games.push([a, b]);
    if (a > b) gamesA++;
    else gamesB++;
    if (gamesA >= needed || gamesB >= needed) break; // match decided; ignore any trailing games
  }

  let winnerId = null;
  let winnerName = null;
  let status = "scheduled";
  if (gamesA >= needed) {
    winnerId = match.participantAId;
    winnerName = match.participantAName;
    status = "completed";
  } else if (gamesB >= needed) {
    winnerId = match.participantBId;
    winnerName = match.participantBName;
    status = "completed";
  }

  const updated = db.update("matches", matchId, {
    games,
    scoreA: gamesA,
    scoreB: gamesB,
    status,
    penalties: null,
    winnerId,
    winnerName,
  });
  if (status === "completed" && updated.nextMatchId && winnerId) propagateWinner(updated);
  return updated;
}

function eventMatches(eventId) {
  return db
    .where("matches", (m) => m.eventId === eventId)
    .sort((a, b) => a.matchNumber - b.matchNumber);
}

function groupStandings(eventId) {
  const matches = eventMatches(eventId);
  const groupNames = [...new Set(matches.filter((m) => m.groupName).map((m) => m.groupName))];
  return groupNames.map((name) => {
    const groupMatches = matches.filter((m) => m.groupName === name);
    const participantsMap = new Map();
    groupMatches.forEach((m) => {
      participantsMap.set(m.participantAId, { id: m.participantAId, name: m.participantAName });
      participantsMap.set(m.participantBId, { id: m.participantBId, name: m.participantBName });
    });
    return {
      name,
      standings: computeStandings(groupMatches, [...participantsMap.values()]),
    };
  });
}

function overallStandings(eventId) {
  const matches = eventMatches(eventId).filter((m) => m.stage === "round_robin");
  const participantsMap = new Map();
  matches.forEach((m) => {
    participantsMap.set(m.participantAId, { id: m.participantAId, name: m.participantAName });
    participantsMap.set(m.participantBId, { id: m.participantBId, name: m.participantBName });
  });
  return computeStandings(matches, [...participantsMap.values()]);
}

// Tournament-wide leaders computed from completed matches: goal scorers and
// assist providers (from recorded goalEvents), plus a team-level defensive
// leaderboard (clean sheets / goals conceded) derived from the scoreline.
function eventStats(eventId) {
  const matches = eventMatches(eventId).filter((m) => m.status === "completed");

  const scorers = {};
  const assisters = {};
  matches.forEach((m) => {
    (m.goalEvents || []).forEach((g) => {
      if (g.scorer) scorers[g.scorer] = (scorers[g.scorer] || 0) + 1;
      if (g.assist) assisters[g.assist] = (assisters[g.assist] || 0) + 1;
    });
  });
  const topScorers = Object.entries(scorers)
    .map(([name, goals]) => ({ name, goals }))
    .sort((a, b) => b.goals - a.goals);
  const topAssists = Object.entries(assisters)
    .map(([name, assists]) => ({ name, assists }))
    .sort((a, b) => b.assists - a.assists);

  const defenseById = {};
  const credit = (id, name, conceded) => {
    if (!id) return;
    const d = defenseById[id] || (defenseById[id] = { id, name, played: 0, conceded: 0, cleanSheets: 0 });
    d.played++;
    d.conceded += conceded;
    if (conceded === 0) d.cleanSheets++;
  };
  matches.forEach((m) => {
    if (m.scoreA == null || m.scoreB == null) return;
    credit(m.participantAId, m.participantAName, m.scoreB);
    credit(m.participantBId, m.participantBName, m.scoreA);
  });
  const bestDefense = Object.values(defenseById).sort(
    (a, b) => b.cleanSheets - a.cleanSheets || a.conceded - b.conceded
  );

  return { topScorers, topAssists, bestDefense };
}

function createKnockoutFromGroups(eventId, advancePerGroup = 2) {
  const groups = groupStandings(eventId);
  const incomplete = eventMatches(eventId).some(
    (m) => m.stage === "group" && m.status !== "completed"
  );
  if (incomplete) {
    throw new Error("All group-stage matches must be completed before generating the knockout stage.");
  }
  const advancers = [];
  for (let place = 0; place < advancePerGroup; place++) {
    groups.forEach((g) => {
      if (g.standings[place]) advancers.push(g.standings[place]);
    });
  }
  if (advancers.length < 2) {
    throw new Error("Not enough qualifiers to build a knockout stage.");
  }
  const existingMax = Math.max(0, ...eventMatches(eventId).map((m) => m.matchNumber));
  createKnockout(eventId, advancers, "knockout", existingMax + 1);
  return advancers;
}

module.exports = {
  createRoundRobin,
  createGroupStage,
  createKnockout,
  createKnockoutFromGroups,
  recordScore,
  recordGameScores,
  recordPenalties,
  recordGoalEvents,
  clearScore,
  eventMatches,
  groupStandings,
  overallStandings,
  eventStats,
  clearEventMatches,
};
