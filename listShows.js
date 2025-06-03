// listShows.js
const sqlite3 = require('sqlite3').verbose();
const path    = require('path');

// adjust to your DB path:
const dbPath = path.join(__dirname, 'data', 'anime.db');
const db     = new sqlite3.Database(dbPath, err => {
  if (err) {
    console.error('Failed to open DB:', err);
    process.exit(1);
  }
});

db.all('SELECT id, title FROM shows', (err, rows) => {
  if (err) {
    console.error('Error querying shows:', err);
  } else {
    console.log('Existing shows:');
    rows.forEach(r => console.log(`  id=${r.id}  title="${r.title}"`));
  }
  db.close();
});
