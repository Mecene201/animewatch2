// scripts/addUserColumns.js
const sqlite3 = require('sqlite3').verbose();
const path   = require('path');

const db = new sqlite3.Database(
  path.join(__dirname, '../data/anime.db'),
  err => { if (err) console.error('Open error:', err); }
);

db.serialize(() => {
  // email & password from before…
  db.run(`ALTER TABLE users ADD COLUMN email TEXT`,   () => {});
  db.run(`ALTER TABLE users ADD COLUMN password TEXT`,() => {});

  // now add picture_url
  console.log('Adding picture_url column…');
  db.run(`ALTER TABLE users ADD COLUMN picture_url TEXT`, err => {
    if (err && !/duplicate column name/.test(err.message)) {
      console.error('picture_url error:', err.message);
    } else {
      console.log('  ✔️ picture_url column added (or already exists)');
    }
  });

  // ensure email stays unique
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)`, () => {});

  console.log('Done.');
  db.close();
});
