// routes/admin.js
const express  = require('express');
const path     = require('path');
const sqlite3  = require('sqlite3').verbose();
const router   = express.Router();

// —————————————————————————————
// Database setup (shared anime.db)
const db = new sqlite3.Database(
  path.join(__dirname, '..', 'data', 'anime.db'),
  err => { if (err) console.error('SQLite open error:', err); }
);

// Ensure movie_urls table exists
db.run(`
  CREATE TABLE IF NOT EXISTS movie_urls (
    showId   INTEGER PRIMARY KEY,
    videoUrl TEXT,
    FOREIGN KEY(showId) REFERENCES shows(id) ON DELETE CASCADE
  )
`);

// —————————————————————————————
// Auth & Admin middleware
function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  res.status(401).json({ message: 'Not authenticated' });
}
function requireAdmin(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  if (!req.session.user.isAdmin) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
}
router.use(requireAuth, requireAdmin);

// —————————————————————————————
// GET /api/admin/anime
router.get('/anime', (req, res) => {
  const sql = `
    SELECT 
      s.id,
      s.title,
      s.releaseDate,
      s.description,
      s.status,
      s.type,
      s.thumbnail,
      s.banner_url         AS bannerUrl,
      s.featured,
      GROUP_CONCAT(g.name) AS genres,
      m.videoUrl           AS movieUrl
    FROM shows s
    LEFT JOIN show_genres sg   ON sg.showId   = s.id
    LEFT JOIN genres g         ON sg.genreId   = g.id
    LEFT JOIN movie_urls m     ON m.showId     = s.id
    GROUP BY s.id
    ORDER BY s.title
  `;
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    const list = rows.map(r => ({
      id:          r.id,
      title:       r.title,
      releaseDate: r.releaseDate,
      description: r.description,
      status:      r.status,
      type:        r.type,
      thumbnail:   r.thumbnail,
      bannerUrl:   r.bannerUrl,
      featured:    r.featured,
      genre:       r.genres ? r.genres.split(',') : [],
      movieUrl:    r.movieUrl || null
    }));
    res.json(list);
  });
});

// —————————————————————————————
// GET /api/admin/anime/:id
router.get('/anime/:id', (req, res) => {
  const showId = +req.params.id;
  db.get(
    `SELECT 
       id, title, releaseDate, description,
       status, type, thumbnail,
       banner_url AS bannerUrl, featured
     FROM shows
     WHERE id = ?`,
    [showId],
    (err, show) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      if (!show) return res.status(404).json({ message: 'Show not found' });

      // 1) movie URL
      db.get(
        `SELECT videoUrl FROM movie_urls WHERE showId = ?`,
        [showId],
        (errMv, rowMv) => {
          show.movieUrl = rowMv ? rowMv.videoUrl : null;

          // 2) genres
          db.all(
            `SELECT g.name
               FROM show_genres sg
               JOIN genres g ON sg.genreId = g.id
              WHERE sg.showId = ?`,
            [showId],
            (errG, genreRows) => {
              if (errG) return res.status(500).json({ message: 'Database error' });
              show.genre = genreRows.map(r => r.name);

              if (show.type === 'Movie') {
                // no seasons for movies
                return res.json({ show, seasons: [] });
              }

              // 3) load seasons
              db.all(
                `SELECT seasonNumber, seasonTitle
                   FROM seasons
                  WHERE showId = ?
                  ORDER BY seasonNumber`,
                [showId],
                (errS, seasons) => {
                  if (errS) return res.status(500).json({ message: 'Database error' });

                  // 4) load all episodes regardless of season
                  db.all(
                    `SELECT seasonNumber, episodeNumber, episodeTitle, videoUrl
                       FROM episodes
                      WHERE showId = ?
                      ORDER BY seasonNumber, episodeNumber`,
                    [showId],
                    (errE, episodes) => {
                      if (errE) return res.status(500).json({ message: 'Database error' });

                      // 5) group into a map, so we get dummy seasons if needed
                      const map = {};
                      // pre-seed real seasons
                      seasons.forEach(s => {
                        map[s.seasonNumber] = {
                          seasonNumber: s.seasonNumber,
                          seasonTitle:  s.seasonTitle || '',
                          episodes:     []
                        };
                      });
                      // then assign every episode
                      episodes.forEach(ep => {
                        if (!map[ep.seasonNumber]) {
                          map[ep.seasonNumber] = {
                            seasonNumber: ep.seasonNumber,
                            seasonTitle:  '',
                            episodes:     []
                          };
                        }
                        map[ep.seasonNumber].episodes.push(ep);
                      });
                      // turn map → sorted array
                      const nested = Object.values(map)
                        .sort((a, b) => a.seasonNumber - b.seasonNumber);

                      res.json({ show, seasons: nested });
                    }
                  );
                }
              );
            }
          );
        }
      );
    }
  );
});

// —————————————————————————————
// POST /api/admin/anime
router.post('/anime', (req, res) => {
  const {
    title, releaseDate, description,
    status, type, thumbnail, bannerUrl = null,
    genre = [], seasons = [], movieUrl
  } = req.body;

  db.serialize(() => {
    db.run(
      `INSERT INTO shows
         (title, releaseDate, description, status, type, thumbnail, banner_url, featured)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      [title, releaseDate, description, status, type, thumbnail, bannerUrl],
      function(err) {
        if (err) return res.status(500).json({ message: 'Database error', error: err });
        const showId = this.lastID;

        // genres
        genre.forEach(name => {
          db.run(`INSERT OR IGNORE INTO genres (name) VALUES (?)`, [name], e => {
            if (e) console.error(e);
            db.get(`SELECT id FROM genres WHERE name = ?`, [name], (e2, row) => {
              if (!e2 && row) {
                db.run(
                  `INSERT INTO show_genres (showId, genreId) VALUES (?, ?)`,
                  [showId, row.id],
                  e3 => { if (e3) console.error(e3); }
                );
              }
            });
          });
        });

        // movie URL
        if (type === 'Movie' && movieUrl) {
          db.run(
            `INSERT OR REPLACE INTO movie_urls (showId, videoUrl) VALUES (?, ?)`,
            [showId, movieUrl],
            e => { if (e) console.error(e); }
          );
        }

        // seasons & episodes
        if (type !== 'Movie') {
          seasons.forEach(s => {
            db.run(
              `INSERT INTO seasons (showId, seasonNumber, seasonTitle)
               VALUES (?, ?, ?)`,
              [showId, s.seasonNumber, s.seasonTitle],
              e => { if (e) console.error(e); }
            );
            s.episodes.forEach(ep => {
              db.run(
                `INSERT INTO episodes
                   (showId, seasonNumber, episodeNumber, episodeTitle, videoUrl)
                 VALUES (?, ?, ?, ?, ?)`,
                [showId, s.seasonNumber, ep.episodeNumber, ep.episodeTitle, ep.videoUrl],
                e => { if (e) console.error(e); }
              );
            });
          });
        }

        res.json({ message: 'Anime added successfully!', id: showId });
      }
    );
  });
});

// —————————————————————————————
// PUT /api/admin/anime/:id  ← now logs & returns the raw sqlite error
router.put('/anime/:id', (req, res) => {
  const showId = +req.params.id;
  const {
    title, releaseDate, description,
    status, type, thumbnail, bannerUrl = null,
    genre = [], seasons = [], movieUrl
  } = req.body;

  db.serialize(() => {
    db.run(
      `UPDATE shows
         SET title = ?, releaseDate = ?, description = ?, status = ?, type = ?, thumbnail = ?, banner_url = ?
       WHERE id = ?`,
      [title, releaseDate, description, status, type, thumbnail, bannerUrl, showId],
      function(err) {
        if (err) {
          console.error('Error updating show:', err);
          return res.status(500).json({ message: 'Database error', error: err.message });
        }
        if (this.changes === 0) {
          return res.status(404).json({ message: 'Show not found' });
        }

        // genres
        db.run(`DELETE FROM show_genres WHERE showId = ?`, [showId]);
        genre.forEach(name => {
          db.run(`INSERT OR IGNORE INTO genres (name) VALUES (?)`, [name]);
          db.get(`SELECT id FROM genres WHERE name = ?`, [name], (e2, row) => {
            if (row) {
              db.run(
                `INSERT INTO show_genres (showId, genreId) VALUES (?, ?)`,
                [showId, row.id]
              );
            }
          });
        });

        // delete old seasons & episodes
        db.run(`DELETE FROM episodes WHERE showId = ?`, [showId]);
        db.run(`DELETE FROM seasons  WHERE showId = ?`, [showId]);

        // movieUrl upsert/delete
        if (type === 'Movie' && movieUrl) {
          db.run(
            `INSERT OR REPLACE INTO movie_urls (showId, videoUrl) VALUES (?, ?)`,
            [showId, movieUrl]
          );
        } else {
          db.run(`DELETE FROM movie_urls WHERE showId = ?`, [showId]);
        }

        // re-insert seasons & episodes
        if (type !== 'Movie') {
          seasons.forEach(s => {
            db.run(
              `INSERT INTO seasons (showId, seasonNumber, seasonTitle)
               VALUES (?, ?, ?)`,
              [showId, s.seasonNumber, s.seasonTitle],
              e => { if (e) console.error('Error inserting season:', e); }
            );
            s.episodes.forEach(ep => {
              db.run(
                `INSERT INTO episodes
                   (showId, seasonNumber, episodeNumber, episodeTitle, videoUrl)
                 VALUES (?, ?, ?, ?, ?)`,
                [showId, s.seasonNumber, ep.episodeNumber, ep.episodeTitle, ep.videoUrl],
                e => { if (e) console.error('Error inserting episode:', e); }
              );
            });
          });
        }

        res.json({ message: 'Anime updated successfully!' });
      }
    );
  });
});

// —————————————————————————————
// DELETE /api/admin/anime/:id
router.delete('/anime/:id', (req, res) => {
  const showId = +req.params.id;
  db.serialize(() => {
    db.run(`DELETE FROM show_genres WHERE showId = ?`, [showId]);
    db.run(`DELETE FROM episodes    WHERE showId = ?`, [showId]);
    db.run(`DELETE FROM seasons     WHERE showId = ?`, [showId]);
    db.run(`DELETE FROM movie_urls  WHERE showId = ?`, [showId]);
    db.run(`DELETE FROM shows       WHERE id     = ?`, [showId], function(err) {
      if (err) return res.status(500).json({ message: 'Database error' });
      if (this.changes === 0) return res.status(404).json({ message: 'Show not found' });
      res.json({ message: 'Anime deleted successfully!' });
    });
  });
});

// —————————————————————————————
// ─── Episodes Endpoints ──────────────────────────────────────────────────────

// GET episodes for a show, ordered by drag-drop position
router.get('/episodes', (req, res) => {
  const showId = parseInt(req.query.showId, 10);
  if (!showId) {
    return res.status(400).json({ error: 'showId query parameter is required' });
  }

  db.all(
    `SELECT
       id,
       showId,
       seasonNumber,
       episodeNumber,
       episodeTitle,
       videoUrl
     FROM episodes
     WHERE showId = ?
     ORDER BY position ASC`,
    [showId],
    (err, rows) => {
      if (err) {
        console.error('Error fetching episodes:', err);
        return res.status(500).json({ error: 'Failed to load episodes' });
      }
      res.json({ episodes: rows });
    }
  );
});

// POST reorder: update positions after drag-drop
router.post('/episodes/reorder', (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order)) {
    return res.status(400).json({ error: 'Order must be an array of episode IDs' });
  }

  db.serialize(() => {
    const stmt = db.prepare('UPDATE episodes SET position = ? WHERE id = ?');
    order.forEach((id, idx) => {
      stmt.run(idx + 1, id);
    });
    stmt.finalize(err => {
      if (err) {
        console.error('Error saving new order:', err);
        return res.status(500).json({ error: err.message });
      }
      res.json({ success: true });
    });
  });
});

// —————————————————————————————
// Genre Endpoints
router.get('/genres', (req, res) => {
  db.all(`SELECT name FROM genres ORDER BY name`, [], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    res.json(rows.map(r => r.name));
  });
});
router.post('/genres', (req, res) => {
  const { genre } = req.body;
  db.run(`INSERT OR IGNORE INTO genres (name) VALUES (?)`, [genre], function(err) {
    if (err) return res.status(500).json({ message: 'Database error' });
    res.json({ message: 'Genre added' });
  });
});
router.put('/genres/:oldName', (req, res) => {
  const oldName   = decodeURIComponent(req.params.oldName);
  const { genre } = req.body;
  db.run(`UPDATE genres SET name = ? WHERE name = ?`, [genre, oldName], function(err) {
    if (err) return res.status(500).json({ message: 'Database error' });
    if (this.changes === 0) return res.status(404).json({ message: 'Genre not found' });
    res.json({ message: 'Genre renamed' });
  });
});
router.delete('/genres/:name', (req, res) => {
  const name = decodeURIComponent(req.params.name);
  db.serialize(() => {
    db.get(`SELECT id FROM genres WHERE name = ?`, [name], (err, row) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      if (!row) return res.status(404).json({ message: 'Genre not found' });
      const genreId = row.id;
      db.run(`DELETE FROM show_genres WHERE genreId = ?`, [genreId]);
      db.run(`DELETE FROM genres        WHERE id      = ?`, [genreId], function(err2) {
        if (err2) return res.status(500).json({ message: 'Database error' });
        res.json({ message: 'Genre deleted' });
      });
    });
  });
});

// —————————————————————————————
// Featured-Anime Endpoint (multiple)
router.post('/featured', (req, res) => {
  const { animeIds } = req.body;   // expect an array of IDs
  if (!Array.isArray(animeIds)) {
    return res.status(400).json({ error: 'animeIds must be an array' });
  }
  db.serialize(() => {
    db.run(`UPDATE shows SET featured = 0`, err => {
      if (err) return res.status(500).json({ error: err.message });
      const stmt = db.prepare(`UPDATE shows SET featured = 1 WHERE id = ?`);
      animeIds.forEach(id => stmt.run(id));
      stmt.finalize(err2 => {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json({ success: true });
      });
    });
  });
});

// —————————————————————————————
// Avatar Library Endpoints
router.get('/avatars', (req, res) => {
  db.all(
    `SELECT id, url, name, is_premium AS isPremium, cost
     FROM avatars
     ORDER BY id`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      res.json({ avatars: rows });
    }
  );
});
router.post('/avatars', (req, res) => {
  const { url, name, isPremium = 0, cost = 0 } = req.body;
  db.run(
    `INSERT INTO avatars (url, name, is_premium, cost)
     VALUES (?, ?, ?, ?)`,
    [url, name, isPremium ? 1 : 0, cost],
    function(err) {
      if (err) return res.status(500).json({ message: 'Database error' });
      res.json({ id: this.lastID });
    }
  );
});
router.put('/avatars/:id', (req, res) => {
  const id = +req.params.id;
  const { name, isPremium = 0, cost = 0 } = req.body;
  db.run(
    `UPDATE avatars SET name = ?, is_premium = ?, cost = ? WHERE id = ?`,
    [name, isPremium ? 1 : 0, cost, id],
    function(err) {
      if (err) return res.status(500).json({ message: 'Database error' });
      if (this.changes === 0) return res.status(404).json({ message: 'Avatar not found' });
      res.json({ message: 'Avatar updated' });
    }
  );
});
router.delete('/avatars/:id', (req, res) => {
  const id = +req.params.id;
  db.run(
    `DELETE FROM avatars WHERE id = ?`,
    [id],
    function(err) {
      if (err) return res.status(500).json({ message: 'Database error' });
      if (this.changes === 0) return res.status(404).json({ message: 'Avatar not found' });
      res.json({ message: 'Avatar deleted' });
    }
  );
});

// —————————————————————————————
// Adjust User Coins
router.post('/users/coins', (req, res) => {
  const { username, amount } = req.body;
  if (!username || typeof amount !== 'number' || isNaN(amount)) {
    return res.status(400).json({ message: 'Enter valid username & amount' });
  }
  db.get(
    'SELECT id, coins FROM users WHERE username = ?',
    [username],
    (err, row) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      if (!row) return res.status(404).json({ message: 'User not found' });
      const newBalance = row.coins + amount;
      db.run(
        'UPDATE users SET coins = ? WHERE id = ?',
        [newBalance, row.id],
        function(err2) {
          if (err2) return res.status(500).json({ message: 'Database error' });
          res.json({ username, newBalance });
        }
      );
    }
  );
});

module.exports = router;









