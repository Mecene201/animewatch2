// scripts/dumpSchema.js
const sqlite3 = require('sqlite3').verbose();
const path   = require('path');

const db = new sqlite3.Database(
  path.join(__dirname, '..', 'data', 'anime.db'),
  err => { if (err) console.error('SQLite open error:', err); }
);

const tables = [
  'avatars',
  'comment_reactions',
  'episodes',
  'genres',
  'movie_urls',
  'seasons',
  'show_genres',
  'shows',
  'users'
];

db.serialize(() => {
  tables.forEach(table => {
    db.all(`PRAGMA table_info(${table});`, (err, cols) => {
      if (err) {
        console.error(`Error reading ${table}:`, err.message);
        return;
      }
      console.log(`\nTable: ${table}`);
      console.log('┌───┬──────────────┬───────┬─────┐');
      console.log('│cid│ name         │ type  │ pk  │');
      console.log('├───┼──────────────┼───────┼─────┤');
      cols.forEach(c => {
        const cid  = String(c.cid).padEnd(3);
        const name = c.name.padEnd(12);
        const typ  = c.type.padEnd(6);
        const pk   = String(c.pk).padEnd(3);
        console.log(`│${cid}│ ${name}│ ${typ}│ ${pk} │`);
      });
      console.log('└───┴──────────────┴───────┴─────┘');
    });
  });
  // give queries time to finish
  setTimeout(() => db.close(), 500);
});
