// routes/avatars.js
const express = require('express');
const path    = require('path');
const sqlite3 = require('sqlite3').verbose();
const router  = express.Router();
const db = new sqlite3.Database(
  path.join(__dirname, '../data/anime.db'),
  err => { if (err) console.error(err); }
);

// Public endpoint: list all avatars
router.get('/', (req, res) => {
  db.all(
    `SELECT
       id,
       url,
       name,
       is_premium   AS isPremium,
       cost
     FROM avatars
     ORDER BY id`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      res.json({ avatars: rows });
    }
  );
});

module.exports = router;
