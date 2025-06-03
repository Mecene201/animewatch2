// assignHeroRole.js
// Run with:  node assignHeroRole.js

const sqlite3 = require('sqlite3').verbose();
const path   = require('path');

// 1) Point at your anime.db
const db = new sqlite3.Database(
  path.join(__dirname, 'data', 'anime.db'),
  err => {
    if (err) {
      console.error('❌ Could not open anime.db:', err.message);
      process.exit(1);
    }
  }
);

// 2) Change this to the helper’s exact username
const helperUsername = 'yourHelperUsername';

db.serialize(() => {
  // A) Ensure “hero” exists in permissions
  db.run(
    `INSERT OR IGNORE INTO permissions(name) VALUES('hero');`
  );

  // B) Ensure “Hero Manager” exists in roles
  db.run(
    `INSERT OR IGNORE INTO roles(name) VALUES('Hero Manager');`
  );

  // C) Link “Hero Manager” → “hero” in role_permissions
  db.run(
    `
    INSERT OR IGNORE INTO role_permissions(roleId, permissionId)
      VALUES(
        (SELECT id FROM roles       WHERE name = 'Hero Manager'),
        (SELECT id FROM permissions WHERE name = 'hero')
      );
    `
  );

  // D) Link helper user → “Hero Manager” in user_roles
  db.run(
    `
    INSERT OR IGNORE INTO user_roles(userId, roleId)
      VALUES(
        (SELECT id FROM users WHERE username = ?),
        (SELECT id FROM roles WHERE name = 'Hero Manager')
      );
    `,
    [helperUsername]
  );
});

db.close(err => {
  if (err) {
    console.error('❌ Error closing DB:', err.message);
  } else {
    console.log('✅ Done: helper was granted “hero” permission via “Hero Manager” role.');
  }
});
