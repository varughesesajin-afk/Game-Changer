const db = require("./db");
const fixtures = require("./fixtures");
const { computeStandings } = require("./standings");

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
    status: match.participantAId && match.participantBId ? "scheduled" : "pending",
    winnerId: null,
    winnerName: null,
  });
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
  clearScore,
  eventMatches,
  groupStandings,
  overallStandings,
  clearEventMatches,
};
