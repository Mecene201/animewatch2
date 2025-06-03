// scripts/dedupe.js
const sqlite3 = require('sqlite3').verbose();
const path   = require('path');

const db = new sqlite3.Database(
  path.join(__dirname, '../data/anime.db'),
  err => { if (err) console.error('Open error:', err); }
);

db.serialize(() => {
  console.log('1) Removing duplicate shows, keeping lowest id per title...');
  db.run(`
    DELETE FROM shows
    WHERE id NOT IN (
      SELECT MIN(id)
      FROM shows
      GROUP BY title
    )
  `, err => {
    if (err) console.error('Error deleting shows:', err);
    else console.log('  ✔️ Duplicates removed from shows');
  });

  console.log('2) Cleaning orphaned show_genres...');
  db.run(`
    DELETE FROM show_genres
    WHERE showId NOT IN (SELECT id FROM shows)
  `, err => {
    if (err) console.error('Error cleaning show_genres:', err);
    else console.log('  ✔️ Orphaned show_genres cleared');
  });

  console.log('3) Cleaning orphaned seasons...');
  db.run(`
    DELETE FROM seasons
    WHERE show_id NOT IN (SELECT id FROM shows)
  `, err => {
    if (err) console.error('Error cleaning seasons:', err);
    else console.log('  ✔️ Orphaned seasons cleared');
  });

  console.log('4) Cleaning orphaned episodes...');
  db.run(`
    DELETE FROM episodes
    WHERE season_id NOT IN (SELECT id FROM seasons)
  `, err => {
    if (err) console.error('Error cleaning episodes:', err);
    else console.log('  ✔️ Orphaned episodes cleared');
  });

  console.log('5) Cleaning orphaned movie_urls...');
  db.run(`
    DELETE FROM movie_urls
    WHERE showId NOT IN (SELECT id FROM shows)
  `, err => {
    if (err) console.error('Error cleaning movie_urls:', err);
    else console.log('  ✔️ Orphaned movie_urls cleared');
  });

  console.log('\nAll done!');
  db.close();
});
