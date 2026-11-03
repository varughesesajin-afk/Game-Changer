const { getSport } = require("./sports");

function suggestFormat(participantCount, sportKey) {
  const sport = getSport(sportKey);
  const n = participantCount;
  const noun = sport && sport.category === "individual" ? "players" : "teams";

  if (n < 2) {
    return {
      count: n,
      primary: null,
      alternatives: [],
      note: `Need at least 2 ${noun} registered before a fixture format can be suggested.`,
    };
  }

  const options = [];

  if (n === 2) {
    options.push({
      format: "knockout",
      label: "Single Match",
      reason: `Only 2 ${noun} registered — it's a single decider match.`,
    });
    return { count: n, primary: options[0], alternatives: [], note: null };
  }

  if (n <= 6) {
    options.push({
      format: "round_robin",
      label: "Round Robin (league)",
      reason: `With ${n} ${noun}, everyone can play everyone in a reasonable number of matches (${roundRobinMatchCount(n)} total) — the fairest way to find a winner at this size.`,
    });
    options.push({
      format: "knockout",
      label: "Single Elimination Knockout",
      reason: `Faster if you're short on time — ${n} ${noun} needs only ${Math.ceil(Math.log2(n))} rounds, but early losers are out immediately.`,
    });
  } else if (n <= 12) {
    options.push({
      format: "group_knockout",
      label: "Groups + Knockout",
      reason: `With ${n} ${noun}, splitting into groups of 3-4 for a mini round robin, then a knockout among group winners, balances fairness with a manageable schedule.`,
    });
    options.push({
      format: "knockout",
      label: "Single Elimination Knockout",
      reason: `Quickest option — finishes in ${Math.ceil(Math.log2(n))} rounds, but each ${noun.slice(0, -1)} gets only one chance.`,
    });
    if (n <= 10) {
      options.push({
        format: "round_robin",
        label: "Round Robin (league)",
        reason: `Every ${noun.slice(0, -1)} plays every other one (${roundRobinMatchCount(n)} matches total) — most thorough, but needs the most time/slots.`,
      });
    }
  } else {
    const groups = Math.ceil(n / 4);
    options.push({
      format: "group_knockout",
      label: "Groups + Knockout",
      reason: `With ${n} ${noun}, a single round robin or knockout gets unwieldy. Split into about ${groups} groups, play a mini-league in each, then send the top finishers into a knockout bracket.`,
    });
    options.push({
      format: "knockout",
      label: "Single Elimination Knockout",
      reason: `Fastest path to a champion (${Math.ceil(Math.log2(n))} rounds) if group play isn't feasible, at the cost of one-and-done matches.`,
    });
  }

  return { count: n, primary: options[0], alternatives: options.slice(1), note: null };
}

function roundRobinMatchCount(n) {
  return (n * (n - 1)) / 2;
}

function nextPowerOfTwo(n) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function roundRobinSchedule(participants) {
  const list = [...participants];
  if (list.length % 2 !== 0) list.push(null);
  const n = list.length;
  const rounds = [];
  const fixed = list[0];
  let rest = list.slice(1);

  for (let r = 0; r < n - 1; r++) {
    const roundList = [fixed, ...rest];
    const pairs = [];
    for (let i = 0; i < n / 2; i++) {
      const a = roundList[i];
      const b = roundList[n - 1 - i];
      if (a && b) pairs.push([a, b]);
    }
    rounds.push(pairs);
    rest = [rest[rest.length - 1], ...rest.slice(0, rest.length - 1)];
  }
  return rounds;
}

function splitIntoGroups(participants, targetSize = 4) {
  const n = participants.length;
  let groupCount = Math.max(1, Math.round(n / targetSize));
  while (groupCount > 1 && n / groupCount < 3) groupCount--;

  const shuffled = shuffle(participants);
  const groups = Array.from({ length: groupCount }, () => []);
  shuffled.forEach((p, i) => groups[i % groupCount].push(p));

  const labels = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return groups.map((members, i) => ({ name: `Group ${labels[i]}`, members }));
}

function knockoutBracket(participants) {
  const seeded = [...participants];
  const size = nextPowerOfTwo(seeded.length);
  const byes = size - seeded.length;
  const order = seedOrder(size);
  const slots = order.map((seedIndex) => {
    if (seedIndex < seeded.length) return seeded[seedIndex];
    return null;
  });
  void byes;

  const round1 = [];
  for (let i = 0; i < slots.length; i += 2) {
    round1.push({ slotA: slots[i], slotB: slots[i + 1] });
  }

  const totalRounds = Math.log2(size);
  const rounds = [round1];
  let prevCount = round1.length;
  for (let r = 1; r < totalRounds; r++) {
    const count = prevCount / 2;
    const round = Array.from({ length: count }, () => ({ slotA: null, slotB: null }));
    rounds.push(round);
    prevCount = count;
  }
  return { rounds, size };
}

function seedOrder(size) {
  if (size === 1) return [0];
  const prev = seedOrder(size / 2);
  const out = [];
  for (const s of prev) {
    out.push(s);
    out.push(size - 1 - s);
  }
  return out;
}

module.exports = {
  suggestFormat,
  roundRobinMatchCount,
  roundRobinSchedule,
  splitIntoGroups,
  knockoutBracket,
  nextPowerOfTwo,
  shuffle,
};
