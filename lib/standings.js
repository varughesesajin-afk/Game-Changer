function computeStandings(matches, participants) {
  const table = {};
  participants.forEach((p) => {
    table[p.id] = {
      id: p.id,
      name: p.name,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      points: 0,
      scoreFor: 0,
      scoreAgainst: 0,
    };
  });

  matches.forEach((m) => {
    if (m.status !== "completed") return;
    const A = table[m.participantAId];
    const B = table[m.participantBId];
    if (!A || !B) return;
    A.played++;
    B.played++;
    A.scoreFor += m.scoreA;
    A.scoreAgainst += m.scoreB;
    B.scoreFor += m.scoreB;
    B.scoreAgainst += m.scoreA;
    if (m.scoreA === m.scoreB) {
      A.draws++;
      B.draws++;
      A.points += 1;
      B.points += 1;
    } else if (m.scoreA > m.scoreB) {
      A.wins++;
      A.points += 3;
      B.losses++;
    } else {
      B.wins++;
      B.points += 3;
      A.losses++;
    }
  });

  return Object.values(table).sort(
    (x, y) =>
      y.points - x.points ||
      y.scoreFor - y.scoreAgainst - (x.scoreFor - x.scoreAgainst) ||
      y.scoreFor - x.scoreFor
  );
}

module.exports = { computeStandings };
