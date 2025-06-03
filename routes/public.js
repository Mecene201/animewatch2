// routes/auth.js
const express  = require('express');
const path     = require('path');
const bcrypt   = require('bcrypt');
const crypto   = require('crypto');
const sqlite3  = require('sqlite3').verbose();
const { sendVerificationEmail } = require('../mail');

const router = express.Router();

// Open the same anime.db
const db = new sqlite3.Database(
  path.join(__dirname, '..', 'data', 'anime.db'),
  err => { if (err) console.error('❌ DB open error:', err); }
);

// Helper to stash minimal user info in session
function createSessionUser(row) {
  return {
    id:       row.id,
    username: row.username,
    isAdmin:  !!row.isAdmin,
    coins:    row.coins
  };
}

// REGISTER
router.post('/register', async (req, res) => {
  const { username, password, email } = req.body;
  if (!username || !password || !email) {
    return res.status(400).json({ message: 'Username, password, and email are required.' });
  }

  // Check duplicate email
  db.get(`SELECT id FROM users WHERE email = ?`, [email], (err, row) => {
    if (err) return res.status(500).json({ message: 'Database error.' });
    if (row) return res.status(409).json({ message: 'Email already in use.' });

    // Hash password
    bcrypt.hash(password, 10, (hashErr, passwordHash) => {
      if (hashErr) return res.status(500).json({ message: 'Error hashing password.' });

      // Generate verification token
      const verifyToken   = crypto.randomBytes(32).toString('hex');
      const verifyExpires = Date.now() + 24 * 60 * 60 * 1000; // 24h

      // Insert user
      const stmt = `
        INSERT INTO users
          (username, passwordHash, email, isVerified, verifyToken, verifyExpires)
        VALUES (?, ?, ?, 0, ?, ?);
      `;
      db.run(
        stmt,
        [username, passwordHash, email, verifyToken, verifyExpires],
        function(insertErr) {
          if (insertErr) {
            console.error(insertErr);
            return res.status(500).json({ message: 'Registration failed.' });
          }

          // Send verification email
          sendVerificationEmail(email, verifyToken)
            .then(() => {
              res.json({ message: 'Registered! Check your email to verify your account.' });
            })
            .catch(mailErr => {
              console.error(mailErr);
              res
                .status(500)
                .json({ message: 'Registered, but failed to send verification email.' });
            });
        }
      );
    });
  });
});

// VERIFY ENDPOINT
router.get('/verify', (req, res) => {
  const { token } = req.query;
  if (!token) return res.send('Invalid link.');

  db.get(
    `SELECT id, verifyExpires FROM users WHERE verifyToken = ?`,
    [token],
    (err, row) => {
      if (err || !row) return res.send('Invalid or expired link.');
      if (row.verifyExpires < Date.now()) return res.send('Verification link has expired.');

      db.run(
        `UPDATE users
         SET isVerified = 1,
             verifyToken = NULL,
             verifyExpires = NULL
         WHERE id = ?`,
        [row.id],
        updateErr => {
          if (updateErr) return res.send('Error verifying email.');
          res.send('Email verified! You can now log in.');
        }
      );
    }
  );
});

// LOGIN
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  db.get(`SELECT * FROM users WHERE username = ?`, [username], async (err, row) => {
    if (err || !row) return res.status(401).json({ message: 'Bad credentials.' });
    if (!row.isVerified)  return res.status(403).json({ message: 'Please verify your email first.' });

    const ok = await bcrypt.compare(password, row.passwordHash);
    if (!ok) return res.status(401).json({ message: 'Bad credentials.' });

    req.session.user = createSessionUser(row);
    res.json({ message: 'Login successful', user: req.session.user });
  });
});

// WHO-AM-I
router.get('/me', (req, res) => {
  res.json({ user: req.session.user || null });
});

// LOGOUT
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ message: 'Logged out.' }));
});

module.exports = router;
