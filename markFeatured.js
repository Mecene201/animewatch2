// markFeatured.js
const sqlite3 = require('sqlite3').verbose();
const path    = require('path');

const SHOW_ID = process.argv[2]; // pass the ID on the command line

if (!SHOW_ID) {
  console.error('Usage: node markFeatured.js <showId>');
  process.exit(1);
}

const dbPath = path.join(__dirname, 'data', 'anime.db');
const db = new sqlite3.Database(dbPath, err => {
  if (err) {
    console.error('Failed to open DB:', err);
    process.exit(1);
  }
});

db.serialize(() => {
  // clear any existing featured flag
  db.run(`UPDATE shows SET featured = 0`, err => {
    if (err) console.error('Error clearing featured:', err);
    // set the new featured
    db.run(
      `UPDATE shows SET featured = 1 WHERE id = ?`,
      [SHOW_ID],
      function(err2) {
        if (err2) {
          console.error('Error marking featured:', err2);
        } else if (this.changes === 0) {
          console.error(`No show with id=${SHOW_ID} found.`);
        } else {
          console.log(`✅ Show ${SHOW_ID} is now featured.`);
        }
        db.close();
      }
    );
  });
});
