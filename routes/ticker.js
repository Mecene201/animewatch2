// routes/ticker.js

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path    = require('path');

const router = express.Router();

// ─── Open your existing ticker.db in the data folder ─────────────────────────
// Adjust the relative path if your “data” folder is in a different location.
// Here we assume “data” is sitting at the project root, alongside server.js.
const dbPath = path.join(__dirname, '..', 'data', 'ticker.db');
const tickerDb = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('⛔️ Could not open ticker database at:', dbPath, err);
    return;
  }
  // Create the “ticker” table if it doesn’t already exist
  tickerDb.run(
    `CREATE TABLE IF NOT EXISTS ticker (
       id         INTEGER PRIMARY KEY AUTOINCREMENT,
       message    TEXT    NOT NULL,
       link       TEXT,
       created_at DATETIME DEFAULT CURRENT_TIMESTAMP
     )`,
    (createErr) => {
      if (createErr) {
        console.error('⛔️ Could not create ticker table:', createErr);
      }
    }
  );
});

// ─── GET /api/ticker — return all ticker items, newest first ─────────────────
router.get('/', (req, res) => {
  tickerDb.all(
    'SELECT * FROM ticker ORDER BY created_at DESC',
    (err, rows) => {
      if (err) {
        console.error('Error fetching ticker items:', err);
        return res.status(500).json({ error: 'Failed to fetch ticker items.' });
      }
      res.json({ ticker: rows });
    }
  );
});

// ─── POST /api/ticker — create a new ticker item ─────────────────────────────
router.post('/', (req, res) => {
  const { message, link } = req.body;
  if (!message || message.trim() === '') {
    return res.status(400).json({ error: 'Field “message” is required.' });
  }

  tickerDb.run(
    'INSERT INTO ticker (message, link) VALUES (?, ?)',
    [message, link || null],
    function (err) {
      if (err) {
        console.error('Error inserting ticker item:', err);
        return res.status(500).json({ error: 'Failed to add ticker item.' });
      }
      res.status(201).json({ id: this.lastID });
    }
  );
});

// ─── PUT /api/ticker/:id — update message and/or link ────────────────────────
router.put('/:id', (req, res) => {
  const id       = parseInt(req.params.id, 10);
  const { message, link } = req.body;

  if (!message || message.trim() === '') {
    return res.status(400).json({ error: 'Field “message” is required.' });
  }

  tickerDb.run(
    `UPDATE ticker
       SET message = ?, link = ?
     WHERE id = ?`,
    [message.trim(), link || null, id],
    function(err) {
      if (err) {
        console.error('Error updating ticker item:', err);
        return res.status(500).json({ error: 'Failed to update ticker item.' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Ticker item not found.' });
      }
      res.json({ success: true });
    }
  );
});

// ─── DELETE /api/ticker/:id — delete ticker item by ID ────────────────────────
router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  tickerDb.run(
    'DELETE FROM ticker WHERE id = ?',
    [id],
    function (err) {
      if (err) {
        console.error('Error deleting ticker item:', err);
        return res.status(500).json({ error: 'Failed to delete ticker item.' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Ticker item not found.' });
      }
      res.json({ success: true });
    }
  );
});

module.exports = router;

