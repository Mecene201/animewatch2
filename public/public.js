const express  = require('express');
const bcrypt   = require('bcrypt');
const sqlite3  = require('sqlite3').verbose();
const router   = express.Router();

// open your same anime.db
const db = new sqlite3.Database(
  path.join(__dirname, '..', 'data', 'anime.db'),
  err => { if (err) console.error(err); }
);

// Helper: stash user minimal info (including coins) in session
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
  const { username, password } = req.body;
  const hash = await bcrypt.hash(password, 10);
  db.run(
    `INSERT INTO users (username, password) VALUES (?,?)`,
    [username, hash],
    function(err) {
      if (err) return res.status(400).json({ message: err.message });
      // pull back the new row to get coins, isAdmin
      db.get(`SELECT * FROM users WHERE id = ?`, [this.lastID], (e,row) => {
        req.session.user = createSessionUser(row);
        res.json({ message: 'Registered!', user: req.session.user });
      });
    }
  );
});

// LOGIN
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  db.get(`SELECT * FROM users WHERE username = ?`, [username], async (err,row) => {
    if (err || !row) return res.status(401).json({ message: 'Bad creds' });
    const ok = await bcrypt.compare(password, row.password);
    if (!ok) return res.status(401).json({ message: 'Bad creds' });
    req.session.user = createSessionUser(row);
    res.json({ message: 'Login successful', user: req.session.user });
  });
});

// WHO-AM-I
router.get('/me', (req, res) => {
  if (!req.session.user) return res.status(200).json({ user: null });
  res.json({ user: req.session.user });
});

// LOGOUT
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ message: 'Logged out' }));
});

module.exports = router;
