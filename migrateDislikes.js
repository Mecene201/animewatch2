// migrateDislikes.js
3 = require('sqlite3').verbose();
const path    = require('path');
const db      = new sqlite3.Database(
  path.join(__dirname, 'data', 'anime.db'),
  err => { if (err) console.error(err); }
);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS comment_dislikes (
      user_id    INTEGER,
      comment_id INTEGER,
      PRIMARY KEY (user_id, comment_id),
      FOREIGN KEY(user_id)    REFERENCES users(id),
      FOREIGN KEY(comment_id) REFERENCES comments(id)
    );
  `);
  console.log('✅ comment_dislikes table ready.');
});
db.close();
