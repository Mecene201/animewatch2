// list_columns.js
const sqlite3 = require('sqlite3').verbose();
const path    = require('path');
const dbPath  = path.join(__dirname, 'data', 'anime.db');

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, err => {
  if (err) {
    console.error('❌ Error opening DB:', err.message);
    process.exit(1);
  }
});

db.all("PRAGMA table_info('episodes')", (err, rows) => {
  if (err) {
    console.error('❌ Error fetching schema:', err.message);
  } else {
    console.log('📋 episodes schema:');
    rows.forEach(col => {
      console.log(` • ${col.name} (${col.type})${col.notnull ? ' NOT NULL' : ''}`);
    });
  }
  db.close();
});
