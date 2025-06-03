// routes/auth.js

require('dotenv').config();
const express    = require('express');
const bcrypt     = require('bcrypt');
const sqlite3    = require('sqlite3').verbose();
const path       = require('path');
const crypto     = require('crypto');
const nodemailer = require('nodemailer');

const router = express.Router();

// ─── Open your SQLite database ─────────────────────────────────────────
const db = new sqlite3.Database(
  path.join(__dirname, '..', 'data', 'anime.db'),
  err => {
    if (err) console.error('❌ Could not open DB:', err);
    else    console.log('✅ Connected to anime.db');
  }
);

// ─── Nodemailer (for email verification) ─────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS
  }
});
transporter.verify((err, success) => {
  if (err) console.error('❌ SMTP connection error:', err);
  else    console.log('✅ SMTP transporter ready');
});

function sendVerificationEmail(to, token) {
  console.log('📧 sendVerificationEmail ->', to, token);
  const verifyUrl = `https://yourdomain.com/api/auth/verify?token=${token}`;
  const html = `
    <p>Thanks for signing up! Verify your email by clicking below:</p>
    <p><a href="${verifyUrl}">${verifyUrl}</a></p>
    <p>This link expires in 24 hours.</p>
  `;
  transporter.sendMail(
    {
      from:    process.env.FROM_EMAIL,
      to,
      subject: 'Verify your AnimeWatch account',
      html
    },
    (err, info) => {
      if (err) console.error('❌ Email error:', err);
      else    console.log('✅ Verification email sent:', info.response);
    }
  );
}

// ─── Helper to shape session user object ──────────────────────────────────
function createSessionUser(row) {
  return {
    id:       row.id,
    username: row.username,
    isAdmin:  !!row.isAdmin,
    coins:    row.coins
    // (we do NOT yet set roles/permissions here — that happens in GET /me)
  };
}


// ─── REGISTER (no auto‐login) ─────────────────────────────────────────────
router.post('/register', async (req, res) => {
  console.log('📝 POST /api/auth/register', req.body);
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res
      .status(400)
      .json({ message: 'Username, email and password required.' });
  }

  try {
    const hash    = await bcrypt.hash(password, 10);
    const token   = crypto.randomBytes(20).toString('hex');
    const expires = Date.now() + 24 * 60 * 60 * 1000; // 24h from now

    db.run(
      `INSERT INTO users
         (username, email, password, verifyToken, verifyExpires)
       VALUES (?, ?, ?, ?, ?);`,
      [username, email, hash, token, expires],
      function(err) {
        if (err) {
          return res.status(400).json({ message: err.message });
        }
        // Send verification email
        sendVerificationEmail(email, token);
        res.json({
          message:
            'Registered! Please check your email for a verification link before logging in.'
        });
      }
    );
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error during registration.' });
  }
});

// ─── VERIFY EMAIL ─────────────────────────────────────────────────────────
router.get('/verify', (req, res) => {
  const token = req.query.token;
  if (!token) {
    return res.status(400).send('Missing token.');
  }

  db.get(
    `SELECT id, verifyExpires
       FROM users
      WHERE verifyToken = ?;`,
    [token],
    (err, row) => {
      if (err)       return res.status(500).send('Server error.');
      if (!row)      return res.status(400).send('Invalid token.');
      if (Date.now() > row.verifyExpires) {
        return res.status(400).send('Token expired.');
      }

      db.run(
        `UPDATE users
            SET isVerified    = 1,
                verifyToken   = NULL,
                verifyExpires = NULL
          WHERE id = ?;`,
        [row.id],
        err2 => {
          if (err2) return res.status(500).send('Could not verify.');
          // Redirect back to login with success flag
          res.redirect('/login.html?verified=1');
        }
      );
    }
  );
});

// ─── LOGIN ─────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  db.get(
    `SELECT * FROM users WHERE username = ?;`,
    [username],
    async (err, row) => {
      if (err || !row) {
        return res.status(401).json({ message: 'Bad creds' });
      }
      const ok = await bcrypt.compare(password, row.password);
      if (!ok) {
        return res.status(401).json({ message: 'Bad creds' });
      }
      if (row.isVerified === 0) {
        return res
          .status(403)
          .json({ message: 'Please verify your email before logging in.' });
      }
      // Now that they’re verified, create the session
      req.session.user = createSessionUser(row);
      res.json({ message: 'Login successful', user: req.session.user });
    }
  );
});

// ─── RESEND VERIFICATION LINK ─────────────────────────────────────────────
router.post('/resend', (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: 'Email is required.' });
  }

  db.get(
    `SELECT id FROM users WHERE email = ? AND isVerified = 0;`,
    [email],
    (err, row) => {
      if (err) return res.status(500).json({ message: 'Server error.' });
      if (!row) {
        return res
          .status(400)
          .json({ message: 'No unverified account found for that email.' });
      }

      const token   = crypto.randomBytes(20).toString('hex');
      const expires = Date.now() + 24 * 60 * 60 * 1000;

      db.run(
        `UPDATE users
            SET verifyToken   = ?,
                verifyExpires = ?
          WHERE id = ?;`,
        [token, expires, row.id],
        err2 => {
          if (err2) return res.status(500).json({ message: 'Could not update token.' });
          sendVerificationEmail(email, token);
          res.json({ message: 'A new verification link has been sent to your email.' });
        }
      );
    }
  );
});


// ─── UPDATED /api/auth/me ────────────────────────────────────────────────
//    We ONLY allow **one** GET /me block. If you have any other GET /me earlier,
//    please remove/comment it out—only this one should remain.
router.get('/me', async (req, res) => {
  // 1) If no session or no ID, return { user: null }
  if (!req.session.user || !req.session.user.id) {
    return res.json({ user: null });
  }
  const userId = req.session.user.id;

  try {
    // 2) Fetch basic user fields
    const userRow = await new Promise((resolve, reject) => {
      db.get(
        `SELECT id, username, email, isAdmin, coins
           FROM users
          WHERE id = ?;`,
        [userId],
        (err, row) => (err ? reject(err) : resolve(row))
      );
    });
    if (!userRow) {
      return res.status(404).json({ error: 'User not found' });
    }

    // 3) Fetch roles assigned to that user
    const userRoles = await new Promise((resolve, reject) => {
      db.all(
        `SELECT r.id, r.name AS title
           FROM roles r
           JOIN user_roles ur ON ur.roleId = r.id
          WHERE ur.userId = ?;`,
        [userId],
        (err, rows) => (err ? reject(err) : resolve(rows))
      );
    });

    // 4) *** Instead of pulling real permissions from role_permissions, ***
    //     *** just copy every role name into “permissions” so Header sees it. ***
    const permissionNames = userRoles.map(r => r.title);

    // 5) Overwrite session.user with the latest info
    req.session.user = {
      id:          userRow.id,
      username:    userRow.username,
      isAdmin:     !!userRow.isAdmin,
      coins:       userRow.coins,
      roles:       userRoles.map(r => r.title),   // e.g. ['anime','genres']
      permissions: permissionNames                 // e.g. ['anime','genres']
    };

    // 6) Return everything
    return res.json({
      user: {
        id:          userRow.id,
        username:    userRow.username,
        email:       userRow.email,
        isAdmin:     !!userRow.isAdmin,
        coins:       userRow.coins,
        roles:       userRoles,        // array of {id, title}
        permissions: permissionNames   // array of strings (now simply role‐names)
      }
    });
  } catch (e) {
    console.error('Error in GET /api/auth/me:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ─── LOGOUT ───────────────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ message: 'Logged out' }));
});

module.exports = router;

