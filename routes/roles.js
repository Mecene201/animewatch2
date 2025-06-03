// routes/roles.js

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path    = require('path');
const router  = express.Router();

// ─── Open the same SQLite database you use elsewhere ────────────────────────
const dbPath = path.join(__dirname, '..', 'data', 'anime.db');
const db     = new sqlite3.Database(dbPath, err => {
  if (err) console.error('❌ Could not open DB for roles:', err);
});

// ─── Middleware: Only allow users whose isAdmin flag is set ────────────────
function requireAdmin(req, res, next) {
  if (!req.session.user || !req.session.user.id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  if (!req.session.user.isAdmin) {
    return res.status(403).json({ error: 'Forbidden: Admins only' });
  }
  next();
}

// ─── 1) GET all permissions ────────────────────────────────────────────────
//    Returns: { permissions: [ { id, name }, … ] }
router.get('/permissions', requireAdmin, (req, res) => {
  db.all(
    `SELECT id, name
       FROM permissions
      ORDER BY name;`,
    [],
    (err, rows) => {
      if (err) {
        console.error('Error fetching permissions:', err.message);
        return res.status(500).json({ error: 'Server error' });
      }
      return res.json({ permissions: rows });
    }
  );
});

// ─── 2) GET all roles (with their assigned permission IDs) ────────────────
//    Returns: { roles: [ { id, title, permissions: [ permissionId, … ] }, … ] }
router.get('/', requireAdmin, (req, res) => {
  // Fetch every role (id + title)
  db.all(
    `SELECT id, title
       FROM roles
      ORDER BY title;`,
    [],
    (err, roleRows) => {
      if (err) {
        console.error('Error fetching roles:', err.message);
        return res.status(500).json({ error: 'Server error' });
      }

      if (roleRows.length === 0) {
        return res.json({ roles: [] });
      }

      const result = [];
      let remaining = roleRows.length;

      // For each role, fetch its permissionIds
      roleRows.forEach(role => {
        db.all(
          `SELECT permissionId
             FROM role_permissions
            WHERE roleId = ?;`,
          [role.id],
          (err2, permRows) => {
            if (err2) {
              console.error(`Error fetching permissions for role ${role.id}:`, err2.message);
              return res.status(500).json({ error: 'Server error' });
            }

            result.push({
              id:          role.id,
              title:       role.title,
              permissions: permRows.map(r => r.permissionId)
            });

            remaining -= 1;
            if (remaining === 0) {
              return res.json({ roles: result });
            }
          }
        );
      });
    }
  );
});

// ─── 3) POST create a new role (minimal version) ────────────────────────────
//    Only inserts into roles(title); skips permissions for now.
// Body: { title: 'Some Role Title', permissions: [1, 3, 4] }
router.post('/', requireAdmin, (req, res) => {
  const { title, permissions } = req.body;
  if (!title || !Array.isArray(permissions)) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  // Only insert into roles(title); skip permissions entirely
  db.run(
    `INSERT INTO roles (title) VALUES (?);`,
    [ title.trim() ],
    function(err) {
      if (err) {
        console.error('Error inserting into roles:', err.message);
        return res.status(500).json({ error: 'Server error' });
      }
      console.log('✔️ Inserted new role ID =', this.lastID);
      return res.status(201).json({ id: this.lastID });
    }
  );
});

// ─── 4) PUT update an existing role ─────────────────────────────────────────
// Body: { title: 'New Role Title', permissions: [2,4] }
router.put('/:id', requireAdmin, (req, res) => {
  const roleId      = Number(req.params.id);
  const { title, permissions } = req.body;
  if (!title || !Array.isArray(permissions)) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  // 4.a) Update the role title
  db.run(
    `UPDATE roles
         SET title = ?
       WHERE id = ?;`,
    [title.trim(), roleId],
    function (err) {
      if (err) {
        console.error(`Error updating role ${roleId}:`, err.message);
        return res.status(500).json({ error: 'Server error' });
      }

      // 4.b) Delete existing permissions mapping
      db.run(
        `DELETE
           FROM role_permissions
          WHERE roleId = ?;`,
        [roleId],
        function (err2) {
          if (err2) {
            console.error(`Error deleting old role_permissions for role ${roleId}:`, err2.message);
            return res.status(500).json({ error: 'Server error' });
          }

          // 4.c) If no new permissions, we’re done
          if (permissions.length === 0) {
            return res.json({ success: true });
          }

          // 4.d) Bulk-insert new role_permissions
          const placeholders = permissions.map(() => `(?, ?)`).join(', ');
          const values = [];
          permissions.forEach(permId => {
            values.push(roleId, permId);
          });

          db.run(
            `INSERT INTO role_permissions (roleId, permissionId) VALUES ${placeholders};`,
            values,
            err3 => {
              if (err3) {
                console.error(`Error inserting new role_permissions for role ${roleId}:`, err3.message);
                return res.status(500).json({ error: 'Server error' });
              }
              return res.json({ success: true });
            }
          );
        }
      );
    }
  );
});

// ─── 5) DELETE a role ───────────────────────────────────────────────────────
router.delete('/:id', requireAdmin, (req, res) => {
  const roleId = Number(req.params.id);
  db.run(
    `DELETE FROM roles WHERE id = ?;`,
    [roleId],
    function (err) {
      if (err) {
        console.error(`Error deleting role ${roleId}:`, err.message);
        return res.status(500).json({ error: 'Server error' });
      }
      return res.json({ success: true });
    }
  );
});

// ─── 6) GET all users with their assigned role IDs ──────────────────────────
//    Returns: { users: [ { id, username, roles: [roleId, …] }, … ] }
router.get('/users', requireAdmin, (req, res) => {
  const sql = `
    SELECT
      u.id,
      u.username,
      GROUP_CONCAT(ur.roleId) AS roleIds
    FROM users u
    LEFT JOIN user_roles ur ON u.id = ur.userId
    GROUP BY u.id
    ORDER BY u.username;
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error('Error fetching users with roles:', err.message);
      return res.status(500).json({ error: 'Server error' });
    }

    const users = rows.map(u => ({
      id:       u.id,
      username: u.username,
      roles:    u.roleIds ? u.roleIds.split(',').map(x => parseInt(x, 10)) : []
    }));

    return res.json({ users });
  });
});

// ─── 7) PUT assign/unassign roles to a specific user ───────────────────────
// Body: { roles: [1,4] }  (full array of role IDs the user should end up with)
router.put('/users/:id/roles', requireAdmin, (req, res) => {
  const userId = Number(req.params.id);
  const { roles } = req.body;
  if (!Array.isArray(roles)) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  // 7.a) Delete any existing user_roles for that user
  db.run(
    `DELETE
       FROM user_roles
      WHERE userId = ?;`,
    [userId],
    function (err) {
      if (err) {
        console.error(`Error deleting existing roles for user ${userId}:`, err.message);
        return res.status(500).json({ error: 'Server error' });
      }

      // 7.b) If no new roles, we’re done
      if (roles.length === 0) {
        return res.json({ success: true });
      }

      // 7.c) Bulk-insert new user_roles
      const placeholders = roles.map(() => `(?, ?)`).join(', ');
      const values = [];
      roles.forEach(roleId => {
        values.push(userId, roleId);
      });

      db.run(
        `INSERT INTO user_roles (userId, roleId) VALUES ${placeholders};`,
        values,
        err2 => {
          if (err2) {
            console.error(`Error inserting roles for user ${userId}:`, err2.message);
            return res.status(500).json({ error: 'Server error' });
          }
          return res.json({ success: true });
        }
      );
    }
  );
});

module.exports = router;
