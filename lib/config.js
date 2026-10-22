const crypto = require("crypto");

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const PORT = process.env.PORT || 3000;

if (!process.env.ADMIN_PASSWORD) {
  console.warn(
    "\n[warning] Using the default admin password 'admin123'. Set ADMIN_PASSWORD in your environment before sharing this app's link with anyone.\n"
  );
}

module.exports = { ADMIN_PASSWORD, SESSION_SECRET, PORT };
