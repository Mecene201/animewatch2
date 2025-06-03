// applyRolesPermissions.js
//
// Run this with: `node applyRolesPermissions.js`
// It will create the new tables (permissions, roles, role_permissions, user_roles)
// and seed the initial permissions rows—without using the sqlite CLI.

const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// 1) Point to your database file:
const dbPath = path.resolve(__dirname, 'animewatch.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Could not open database:', err);
    process.exit(1);
  }
});

// 2) All the SQL from “Step 1” in one big string:
const sql = `
-- ─── 1) Create (or verify) 'permissions' table ────────────────────────────
CREATE TABLE IF NOT EXISTS permissions (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT    NOT NULL UNIQUE
);

-- Insert one row per admin-UI section. Adjust names if you add/remove sections later.
INSERT OR IGNORE INTO permissions (name) VALUES
  ('anime'),
  ('genres'),
  ('avatars'),
  ('hero'),
  ('users'),
  ('comments');

-- ─── 2) Create (or verify) 'roles' table ─────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT    NOT NULL UNIQUE
);

-- ─── 3) Create (or verify) 'role_permissions' join table ─────────────────
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       INTEGER NOT NULL,
  permission_id INTEGER NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  FOREIGN KEY (role_id)       REFERENCES roles(id)       ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

-- ─── 4) Create (or verify) 'user_roles' join table ────────────────────────
CREATE TABLE IF NOT EXISTS user_roles (
  user_id INTEGER NOT NULL,
  role_id INTEGER NOT NULL,
  PRIMARY KEY (user_id, role_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);
`;

// 3) Execute all of it at once:
db.exec(sql, function(err) {
  if (err) {
    console.error('Error applying migration:', err);
  } else {
    console.log('✅ Migration applied successfully.');
  }
  db.close();
});
