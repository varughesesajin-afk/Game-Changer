const db = require("./db");

// ----- Users: created on first Google sign-in. No passwords are stored here —
// Google handles authentication, we just remember who signed in. -----

function publicUser(u) {
  if (!u) return null;
  return { id: u.id, name: u.name, email: u.email, picture: u.picture || "" };
}

function findByGoogleId(googleId) {
  return db.where("users", (u) => u.googleId === googleId)[0] || null;
}

function getUser(id) {
  return db.find("users", id);
}

function findOrCreateFromGoogleProfile(profile) {
  const googleId = profile.sub;
  if (!googleId) throw new Error("Google didn't return an account id.");
  const existing = findByGoogleId(googleId);
  const name = (profile.name || profile.email || "Player").trim().slice(0, 80);
  const picture = profile.picture || "";
  const email = profile.email || "";
  if (existing) {
    return db.update("users", existing.id, { name, picture, email });
  }
  return db.insert("users", "user", { googleId, name, email, picture });
}

module.exports = { publicUser, findByGoogleId, getUser, findOrCreateFromGoogleProfile };
