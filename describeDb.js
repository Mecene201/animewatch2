// describedb.js
//
// Place this file in your project root (e.g., D:\animewatch\describedb.js),
// and ensure your anime.db lives in a subfolder named "data" (e.g., D:\animewatch\data\anime.db).
// Then run `node describedb.js` to list all tables and their schemas.

const fs     = require('fs');
const sqlite = require('sqlite3').verbose();
const path   = require('path');

// Adjusted path: look inside the "data" folder
const dbPath = path.join(__dirname, 'data', 'anime.db');
console.log(`Looking for database file at:\n  ${dbPath}\n`);

if (!fs.existsSync(dbPath)) {
  console.error('❌ Database file not found at that path.');
  console.error('   • Make sure data\\anime.db exists next to describedb.js');
  process.exit(1);
}

const db = new sqlite.Database(dbPath, sqlite.OPEN_READONLY, err => {
  if (err) {
    console.error('❌ Could not open database:', err.message);
    process.exit(1);
  }
  console.log('✅ Successfully opened anime.db\n');

  // 1) List all user-defined tables
  db.all(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';",
    (err, tables) => {
      if (err) {
        console.error('Error listing tables:', err.message);
        db.close();
        return;
      }

      if (tables.length === 0) {
        console.log('⚠️  No user-defined tables found in anime.db.');
        db.close();
        return;
      }

      console.log('📋 Tables found:');
      tables.forEach(row => console.log('  •', row.name));

      // 2) For each table, show its column definitions
      let remaining = tables.length;
      tables.forEach(row => {
        console.log(`\n🔍 Schema for table "${row.name}":`);
        db.all(`PRAGMA table_info(${row.name});`, (err2, cols) => {
          if (err2) {
            console.error(`  Error fetching schema for ${row.name}:`, err2.message);
          } else {
            console.table(cols);
          }
          if (--remaining === 0) {
            db.close();
          }
        });
      });
    }
  );
});
