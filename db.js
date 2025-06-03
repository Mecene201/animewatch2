// db.js
// ─────────────────────────────────────────────────────────────────────────────
// Opens a single SQLite connection to anime.db and exports it.
// ─────────────────────────────────────────────────────────────────────────────

const sqlite3 = require('sqlite3').verbose();
const path    = require('path');

const dbPath = path.join(__dirname, 'data', 'anime.db'); // <-- adjust if your path differs

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
  if (err) {
    console.error('❌ Failed to connect to anime.db:', err.message);
  } else {
    console.log('✅ Connected to anime.db');
  }
});

module.exports = db;
