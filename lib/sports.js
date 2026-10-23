const SPORTS = [
  { key: "football", label: "Football (Soccer)", category: "team", allowDraws: true },
  { key: "cricket", label: "Cricket", category: "team", allowDraws: true },
  { key: "basketball", label: "Basketball", category: "team", allowDraws: false },
  { key: "volleyball", label: "Volleyball", category: "team", allowDraws: false },
  { key: "kabaddi", label: "Kabaddi", category: "team", allowDraws: true },
  { key: "hockey", label: "Hockey", category: "team", allowDraws: true },
  { key: "handball", label: "Handball", category: "team", allowDraws: true },
  { key: "rugby", label: "Rugby", category: "team", allowDraws: true },
  { key: "futsal", label: "Futsal", category: "team", allowDraws: true },
  { key: "baseball", label: "Baseball / Softball", category: "team", allowDraws: false },
  {
    key: "badminton",
    label: "Badminton",
    category: "individual",
    allowDraws: false,
    scoring: { type: "games", pointsToWin: 21, winBy: 2, cap: 30, bestOf: 3 },
  },
  { key: "tennis", label: "Tennis", category: "individual", allowDraws: false },
  { key: "table_tennis", label: "Table Tennis", category: "individual", allowDraws: false },
  { key: "squash", label: "Squash", category: "individual", allowDraws: false },
  { key: "chess", label: "Chess", category: "individual", allowDraws: true },
  { key: "carrom", label: "Carrom", category: "individual", allowDraws: false },
  { key: "athletics", label: "Athletics (track/field)", category: "individual", allowDraws: false },
  { key: "swimming", label: "Swimming", category: "individual", allowDraws: false },
  { key: "other_team", label: "Other team sport", category: "team", allowDraws: true },
  { key: "other_individual", label: "Other individual sport", category: "individual", allowDraws: false },
];

function getSport(key) {
  return SPORTS.find((s) => s.key === key) || null;
}

module.exports = { SPORTS, getSport };
