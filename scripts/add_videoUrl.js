// scripts/add_videoUrl.js
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// adjust the path if your DB is elsewhere
const dbPath = path.join(__dirname, '..', 'data', 'anime.db');

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, err => {
  if (err) {
    console.error('Could not open DB:', err);
    process.exit(1);
  }
});

db.run(
  `ALTER TABLE shows ADD COLUMN videoUrl TEXT`,
  err => {
    if (err) {
      // if it’s “duplicate column” you’ve already run it
      console.error('❌ Migration error (maybe already applied):', err.message);
    } else {
      console.log('✅ Added videoUrl column to shows table');
    }
    db.close();
  }
);
