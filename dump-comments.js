// dump-comments.js
const sqlite = require('sqlite3').verbose();
const path   = require('path');

// adjust path if your DB lives elsewhere
const dbPath = path.join(__dirname, 'data', 'anime.db');
const db     = new sqlite.Database(dbPath, sqlite.OPEN_READONLY, err => {
  if (err) return console.error('Failed to open DB:', err);
});

db.serialize(() => {
  console.log('\n--- comments table schema ---');
  db.all(
    `SELECT sql 
     FROM sqlite_master 
     WHERE type='table' 
       AND name='comments'`, 
    (err, rows) => {
      if (err) console.error(err);
      else rows.forEach(r => console.log(r.sql));
    }
  );

  console.log('\n--- comment_reactions table schema ---');
  db.all(
    `SELECT sql 
     FROM sqlite_master 
     WHERE type='table' 
       AND name='comment_reactions'`,
    (err, rows) => {
      if (err) console.error(err);
      else rows.forEach(r => console.log(r.sql));
    }
  );

  console.log('\n--- sample rows from comments (limit 5) ---');
  db.all(
    `SELECT * FROM comments LIMIT 5`,
    (err, rows) => {
      if (err) console.error(err);
      else console.table(rows);
    }
  );

  console.log('\n--- sample rows from comment_reactions (limit 5) ---');
  db.all(
    `SELECT * FROM comment_reactions LIMIT 5`,
    (err, rows) => {
      if (err) console.error(err);
      else console.table(rows);
    }
  );
});

db.close();
