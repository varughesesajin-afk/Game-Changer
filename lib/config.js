const crypto = require("crypto");

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const PORT = process.env.PORT || 3000;

// Base URL this app is reachable at, used to build the Google OAuth redirect URI.
// Set APP_BASE_URL in production (e.g. https://game-changer-sports.onrender.com).
const APP_BASE_URL = process.env.APP_BASE_URL || `http://localhost:${PORT}`;

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `${APP_BASE_URL}/api/auth/google/callback`;
const GOOGLE_LOGIN_ENABLED = !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);

if (!process.env.ADMIN_PASSWORD) {
  console.warn(
    "\n[warning] Using the default admin password 'admin123'. Set ADMIN_PASSWORD in your environment before sharing this app's link with anyone.\n"
  );
}

if (!GOOGLE_LOGIN_ENABLED) {
  console.warn(
    "\n[warning] GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set. Sign-in with Google is disabled until you add them.\n"
  );
}

module.exports = {
  ADMIN_PASSWORD,
  SESSION_SECRET,
  PORT,
  APP_BASE_URL,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
  GOOGLE_LOGIN_ENABLED,
};
