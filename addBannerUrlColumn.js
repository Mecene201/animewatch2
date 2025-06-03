// scripts/addBannerUrlColumn.js
const sqlite3 = require('sqlite3').verbose();
const path    = require('path');

const db = new sqlite3.Database(
  path.join(__dirname, '..', 'data', 'anime.db'),
  err => { if (err) console.error(err); }
);

db.serialize(() => {
  db.run(
    `ALTER TABLE shows ADD COLUMN banner_url TEXT DEFAULT NULL`,
    err => {
      if (err && !/duplicate column/i.test(err.message)) {
        console.error('Error adding banner_url:', err);
      } else {
        console.log('✔ banner_url column is now present');
      }
      db.close();
    }
  );
});
