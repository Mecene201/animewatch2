// addFeaturedColumn.js
const sqlite3 = require('sqlite3').verbose();
const path    = require('path');

const dbPath = path.join(__dirname, 'data', 'anime.db');
const db = new sqlite3.Database(dbPath, err => {
  if (err) {
    console.error('Failed to open DB:', err);
    process.exit(1);
  }
});

db.all("PRAGMA table_info('shows')", (err, cols) => {
  if (err) {
    console.error('Error checking columns:', err);
    db.close();
    return;
  }

  const hasFeatured = cols.some(c => c.name === 'featured');
  if (hasFeatured) {
    console.log('✔️ Column "featured" already exists, nothing to do.');
    db.close();
  } else {
    db.run(
      "ALTER TABLE shows ADD COLUMN featured INTEGER DEFAULT 0",
      alterErr => {
        if (alterErr) {
          console.error('Error adding column:', alterErr);
        } else {
          console.log('✅ Added "featured" column to shows table.');
        }
        db.close();
      }
    );
  }
});
