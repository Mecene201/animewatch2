// createCommentsTable.js
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
  db.run(`
    CREATE TABLE IF NOT EXISTS comments (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      show_id       INTEGER NOT NULL,
      user_id       INTEGER NOT NULL,
      comment_text  TEXT    NOT NULL,
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (show_id) REFERENCES anime(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `, err => {
    if (err) console.error('Failed to create comments table:', err);
    else     console.log('✅ Comments table ready.');
  });
});

db.close();
