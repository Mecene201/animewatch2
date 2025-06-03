// check.js
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data/anime.db', err => {
  if (err) return console.error('Could not open DB:', err);
});
db.all(
  `SELECT id, title, video_url 
     FROM shows 
    WHERE type = 'Movie'`,
  [],
  (err, rows) => {
    if (err) {
      console.error('Query error:', err);
    } else {
      console.table(rows);
    }
    db.close();
  }
);
