const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

const EMPTY_DB = {
  events: [],
  registrations: [],
  matches: [],
  matchdays: [],
  matchdaySignups: [],
  counters: { event: 1, registration: 1, match: 1, mday: 1, player: 1 },
};

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(EMPTY_DB, null, 2));
  }
}

let cache = null;

function load() {
  ensureDb();
  if (!cache) {
    cache = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    for (const key of Object.keys(EMPTY_DB)) {
      if (!(key in cache)) cache[key] = EMPTY_DB[key];
    }
  }
  return cache;
}

function persist() {
  const tmp = DB_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(cache, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

function nextId(kind) {
  const db = load();
  const n = db.counters[kind] || 1;
  db.counters[kind] = n + 1;
  return `${kind[0]}${n}`;
}

function all(collection) {
  return load()[collection];
}

function find(collection, id) {
  return load()[collection].find((x) => x.id === id) || null;
}

function where(collection, predicate) {
  return load()[collection].filter(predicate);
}

function insert(collection, kind, obj) {
  const db = load();
  const record = { id: nextId(kind), createdAt: new Date().toISOString(), ...obj };
  db[collection].push(record);
  persist();
  return record;
}

function insertMany(collection, kind, objs) {
  const db = load();
  const records = objs.map((obj) => ({
    id: nextId(kind),
    createdAt: new Date().toISOString(),
    ...obj,
  }));
  db[collection].push(...records);
  persist();
  return records;
}

function update(collection, id, patch) {
  const db = load();
  const idx = db[collection].findIndex((x) => x.id === id);
  if (idx === -1) return null;
  db[collection][idx] = {
    ...db[collection][idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  persist();
  return db[collection][idx];
}

function remove(collection, id) {
  const db = load();
  const before = db[collection].length;
  db[collection] = db[collection].filter((x) => x.id !== id);
  persist();
  return db[collection].length < before;
}

function removeWhere(collection, predicate) {
  const db = load();
  const before = db[collection].length;
  db[collection] = db[collection].filter((x) => !predicate(x));
  persist();
  return before - db[collection].length;
}

module.exports = {
  all,
  find,
  where,
  insert,
  insertMany,
  update,
  remove,
  removeWhere,
};
