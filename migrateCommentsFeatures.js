// migrateCommentsFeatures.js
const sqlite3 = require('sqlite3').verbose();
const path    = require('path');

const dbPath = path.join(__dirname, 'data', 'anime.db');
const db     = new sqlite3.Database(dbPath, err => {
  if (err) {
    console.error('SQLite open error:', err);
    process.exit(1);
  }
});

db.serialize(() => {
  // 1) Add parent_id for threading
  db.run(`
    ALTER TABLE comments
    ADD COLUMN parent_id INTEGER REFERENCES comments(id) DEFAULT NULL;
  `);

  // 2) Track when a comment was edited
  db.run(`
    ALTER TABLE comments
    ADD COLUMN edited_at DATETIME DEFAULT NULL;
  `);

  // 3) Create a likes table so users can upvote
  db.run(`
    CREATE TABLE IF NOT EXISTS comment_likes (
      user_id    INTEGER,
      comment_id INTEGER,
      PRIMARY KEY (user_id, comment_id),
      FOREIGN KEY(user_id)    REFERENCES users(id),
      FOREIGN KEY(comment_id) REFERENCES comments(id)
    );
  `);

  console.log('✅ Comments feature migration complete.');
});

db.close();
