// feature.js
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data/anime.db');
db.run(
  `UPDATE shows SET featured = 1 WHERE id = ?`,
  [2],
  function(err) {
    if (err) return console.error('DB error:', err);
    console.log(`Marked show id=2 as featured.`);
    db.close();
  }
);
