// makeAdmin.js

/**
 * Run this script with: node makeAdmin.js
 *
 * It will:
 *   1. Open data/anime.db (where your existing `users` table lives)
 *   2. Create (if necessary) the tables: roles, permissions, role_permissions, user_roles
 *   3. Ensure an "Admin" role exists and seed every permission name
 *   4. Grant all those permissions to the "Admin" role
 *   5. Assign the "Admin" role to the user with username "macy"
 */

const path   = require('path');
const sqlite = require('sqlite3').verbose();

// Hardcode the username you want to make Admin:
const username = 'macy';

// Correct database path (the one that contains your `users` table):
const DB_PATH = path.join(__dirname, 'data', 'anime.db');

const db = new sqlite.Database(DB_PATH, sqlite.OPEN_READWRITE, err => {
  if (err) {
    console.error('❌ Could not open database:', err.message);
    process.exit(1);
  }
  console.log(`✅ Opened database at ${DB_PATH}`);
});

// Wrap everything in one serialize() block so that statements run in order:
db.serialize(() => {
  // 1) Create roles table if missing
  db.run(
    `CREATE TABLE IF NOT EXISTS roles (
       id    INTEGER PRIMARY KEY AUTOINCREMENT,
       title TEXT    NOT NULL UNIQUE
     )`,
    err => {
      if (err) console.error('Error creating `roles` table:', err.message);
      else console.log('✅ `roles` table ready.');
    }
  );

  // 2) Create permissions table if missing
  db.run(
    `CREATE TABLE IF NOT EXISTS permissions (
       id   INTEGER PRIMARY KEY AUTOINCREMENT,
       name TEXT    NOT NULL UNIQUE
     )`,
    err => {
      if (err) console.error('Error creating `permissions` table:', err.message);
      else console.log('✅ `permissions` table ready.');
    }
  );

  // 3) Create role_permissions join table if missing
  db.run(
    `CREATE TABLE IF NOT EXISTS role_permissions (
       roleId       INTEGER NOT NULL,
       permissionId INTEGER NOT NULL,
       PRIMARY KEY (roleId, permissionId),
       FOREIGN KEY(roleId)       REFERENCES roles(id)       ON DELETE CASCADE,
       FOREIGN KEY(permissionId) REFERENCES permissions(id) ON DELETE CASCADE
     )`,
    err => {
      if (err) console.error('Error creating `role_permissions` table:', err.message);
      else console.log('✅ `role_permissions` table ready.');
    }
  );

  // 4) Create user_roles join table if missing
  db.run(
    `CREATE TABLE IF NOT EXISTS user_roles (
       userId INTEGER NOT NULL,
       roleId INTEGER NOT NULL,
       PRIMARY KEY (userId, roleId),
       FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
       FOREIGN KEY(roleId) REFERENCES roles(id) ON DELETE CASCADE
     )`,
    err => {
      if (err) console.error('Error creating `user_roles` table:', err.message);
      else console.log('✅ `user_roles` table ready.');
    }
  );

  // 5) Insert (or ignore) the "Admin" role
  db.run(
    `INSERT OR IGNORE INTO roles (title) VALUES ('Admin')`,
    function(err) {
      if (err) {
        console.error('Error inserting Admin into roles:', err.message);
      } else {
        console.log('✅ Ensured `Admin` role exists.');
      }
    }
  );

  // 6) Seed every permission name (must match data-section="…" in admin.html)
  const permissionsToSeed = [
    'hero',
    'ticker',
    'anime',
    'genres',
    'avatars',
    'users',
    'roleManagement'
  ];
  const insertPermissionStmt = db.prepare(
    `INSERT OR IGNORE INTO permissions (name) VALUES (?)`
  );
  permissionsToSeed.forEach(name => {
    insertPermissionStmt.run(name, err => {
      if (err) console.error(`Error inserting permission "${name}":`, err.message);
    });
  });
  insertPermissionStmt.finalize(err => {
    if (err) console.error('Error finalizing permissions insert:', err.message);
    else console.log('✅ Seeded all permissions (if they were missing).');
  });

  // 7) Grant all permissions to the Admin role
  db.run(
    `
    INSERT OR IGNORE INTO role_permissions (roleId, permissionId)
      SELECT (SELECT id FROM roles WHERE title = 'Admin'), id
        FROM permissions
    `,
    function(err) {
      if (err) {
        console.error('Error granting all permissions to Admin:', err.message);
      } else {
        console.log('✅ Granted all permissions to "Admin" role.');
      }
    }
  );

  // 8) Assign the Admin role to the user "macy"
  //    First look up the userId of "macy".
  db.get(
    `SELECT id FROM users WHERE username = ?`,
    [username],
    (err, userRow) => {
      if (err) {
        console.error('Error looking up user:', err.message);
        closeDatabase();
        return;
      }
      if (!userRow) {
        console.error(`❌ No user found with username "${username}".`);
        closeDatabase();
        return;
      }
      const userId = userRow.id;

      // Next look up the roleId for "Admin".
      db.get(
        `SELECT id FROM roles WHERE title = 'Admin'`,
        (err2, roleRow) => {
          if (err2) {
            console.error('Error looking up Admin role:', err2.message);
            closeDatabase();
            return;
          }
          if (!roleRow) {
            console.error(`❌ "Admin" role not found—did table creation fail?`);
            closeDatabase();
            return;
          }
          const roleId = roleRow.id;

          // Finally insert into user_roles
          db.run(
            `INSERT OR IGNORE INTO user_roles (userId, roleId) VALUES (?, ?)`,
            [userId, roleId],
            function(err3) {
              if (err3) {
                console.error('Error assigning Admin role to user:', err3.message);
              } else {
                console.log(`✅ User "${username}" (id=${userId}) is now Admin (roleId=${roleId}).`);
              }
              // After this last step, close the DB:
              closeDatabase();
            }
          );
        }
      );
    }
  );
});

// Helper to close database AFTER all operations finish
function closeDatabase() {
  db.close(err => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('✅ All done. Database connection closed.');
    }
  });
}
