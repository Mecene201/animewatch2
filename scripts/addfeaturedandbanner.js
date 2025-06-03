// scripts/addFeaturedAndBanner.js
const sqlite3 = require('sqlite3').verbose();
const path    = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'anime.db');
console.log('🔍 Attempting to open database at:', dbPath);

const db = new sqlite3.Database(dbPath, err => {
  if (err) {
    console.error('❌ SQLite open error:', err);
    process.exit(1);
  }
  console.log('✔ Database opened successfully');

  db.serialize(() => {
    db.run(
      `ALTER TABLE shows ADD COLUMN featured INTEGER DEFAULT 0`,
      err => {
        if (err && !/duplicate column/i.test(err.message)) {
          console.error('❌ Error adding featured column:', err);
        } else {
          console.log('✔ Ensured featured column exists');
        }
      }
    );

    db.run(
      `ALTER TABLE shows ADD COLUMN banner_url TEXT DEFAULT NULL`,
      err => {
        if (err && !/duplicate column/i.test(err.message)) {
          console.error('❌ Error adding banner_url column:', err);
        } else {
          console.log('✔ Ensured banner_url column exists');
        }
      }
    );
  });

  db.close(() => {
    console.log('Migration complete.');
  });
});
