// server.js
require('dotenv').config();

const express       = require('express');
const path          = require('path');
const bcrypt        = require('bcrypt');
const session       = require('express-session');
const sqlite3       = require('sqlite3').verbose();

const adminRoutes   = require('./routes/admin');
const commentRoutes = require('./routes/comments');
const animeRoutes   = require('./routes/anime');
const avatarRoutes  = require('./routes/avatars');
const tickerRoutes  = require('./routes/ticker');

// ↓ Import the new roles router
const rolesRoutes   = require('./routes/roles');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── MIDDLEWARE: JSON + REQUEST LOGGING ─────────────────────────────────────
app.use(express.json());
app.use((req, res, next) => {
  console.log(`\n[${new Date().toISOString()}] ${req.method} ${req.url}`);
  if (req.body && Object.keys(req.body).length) {
    console.log('Body:', req.body);
  }
  next();
});

// ─── SESSION SETUP ───────────────────────────────────────────────────────────
app.use(session({
  secret: process.env.SESSION_SECRET || 'change_this_to_a_strong_secret',
  resave: false,
  saveUninitialized: false,
}));

// ─── DATABASE INITIALIZATION ─────────────────────────────────────────────────
const db = new sqlite3.Database(
  path.join(__dirname, 'data', 'anime.db'),
  err => { if (err) console.error('SQLite open error:', err); }
);
db.serialize(() => {
  // Ensure movie_urls table exists
  db.run(`
    CREATE TABLE IF NOT EXISTS movie_urls (
      showId   INTEGER PRIMARY KEY,
      videoUrl TEXT,
      FOREIGN KEY(showId) REFERENCES shows(id) ON DELETE CASCADE
    )
  `);

  // Ensure the `shows` table has a `featured` column (0 or 1)
  db.run(`
    ALTER TABLE shows
    ADD COLUMN featured INTEGER DEFAULT 0
  `, err => {
    // SQLite will error if column already exists; ignore that case
    if (err && !/duplicate column name: featured/i.test(err.message)) {
      console.error('Error adding featured column:', err);
    }
  });

  // Ensure the `genres` table exists
  db.run(`
    CREATE TABLE IF NOT EXISTS genres (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    )
  `, err => {
    if (err) console.error('Error ensuring genres table exists:', err);
  });
});

// ─── AUTHENTICATION ROUTES ──────────────────────────────────────────────────
// (Register / Login / Logout / Who am I / Update profile picture)
// [unchanged from your original code]
app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'username & password required' });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    db.run(
      `INSERT INTO users (username, password, picture_url, coins, isAdmin)
       VALUES (?, ?, NULL, 0, 0)`,
      [username, hash],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE')) {
            return res.status(400).json({ message: 'Username already taken' });
          }
          console.error('Registration DB error:', err);
          return res.status(500).json({ message: 'Database error' });
        }
        req.session.user = {
          id: this.lastID,
          username,
          isAdmin: false,
          pictureUrl: null,
          coins: 0
        };
        res.json({ message: 'Registration successful' });
      }
    );
  } catch (e) {
    console.error('Registration error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'username & password required' });
  }
  db.get(
    `SELECT id, password, isAdmin, picture_url AS pictureUrl, coins
       FROM users WHERE username = ?`,
    [username],
    async (err, row) => {
      if (err) {
        console.error('Login DB error:', err);
        return res.status(500).json({ message: 'Database error' });
      }
      if (!row) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      const match = await bcrypt.compare(password, row.password);
      if (!match) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      req.session.user = {
        id: row.id,
        username,
        isAdmin: !!row.isAdmin,
        pictureUrl: row.pictureUrl,
        coins: row.coins
      };
      res.json({ message: 'Login successful' });
    }
  );
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) console.error('Logout error:', err);
    res.json({ message: 'Logged out' });
  });
});

app.get('/api/auth/me', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  db.get(
    `SELECT id, username, isAdmin, picture_url AS pictureUrl, coins
       FROM users WHERE id = ?`,
    [req.session.user.id],
    (err, row) => {
      if (err) {
        console.error('Auth/me DB error:', err);
        return res.status(500).json({ message: 'Database error' });
      }
      if (!row) {
        return res.status(404).json({ message: 'User not found' });
      }
      req.session.user = {
        id: row.id,
        username: row.username,
        isAdmin: !!row.isAdmin,
        pictureUrl: row.pictureUrl,
        coins: row.coins
      };
      res.json({ user: req.session.user });
    }
  );
});

app.post('/api/auth/profile-picture', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  const userId = req.session.user.id;
  const { pictureUrl } = req.body;
  if (!pictureUrl) {
    return res.status(400).json({ message: 'pictureUrl required' });
  }
  db.run(
    `UPDATE users SET picture_url = ? WHERE id = ?`,
    [pictureUrl, userId],
    function(err) {
      if (err) {
        console.error('Profile-picture DB error:', err);
        return res.status(500).json({ message: 'Database error' });
      }
      req.session.user.pictureUrl = pictureUrl;
      res.json({ message: 'Avatar applied' });
    }
  );
});

// ─── PUBLIC GENRES ROUTE ────────────────────────────────────────────────────
app.get('/api/genres', (req, res) => {
  db.all(`SELECT name FROM genres ORDER BY name`, [], (err, rows) => {
    if (err) {
      console.error('Error fetching genres:', err);
      return res.status(500).json({ message: 'Database error' });
    }
    const genreList = rows.map(r => r.name);
    res.json(genreList);
  });
});

// ─── NEW ADMIN FEATURED ROUTES ───────────────────────────────────────────────
// (unchanged)
app.post('/api/admin/featured', (req, res) => {
  const { animeIds } = req.body;
  if (!Array.isArray(animeIds)) {
    return res.status(400).json({ success: false, message: 'animeIds must be an array' });
  }

  db.serialize(() => {
    db.run(`UPDATE shows SET featured = 0`, err => {
      if (err) {
        console.error('Error clearing featured flags:', err);
        return res.status(500).json({ success: false, message: 'Database error' });
      }
      if (animeIds.length > 0) {
        const placeholders = animeIds.map(() => '?').join(', ');
        const sql = `UPDATE shows SET featured = 1 WHERE id IN (${placeholders})`;
        db.run(sql, animeIds.map(x => Number(x)), function(err2) {
          if (err2) {
            console.error('Error setting featured flags:', err2);
            return res.status(500).json({ success: false, message: 'Database error' });
          }
          return res.json({ success: true, animeIds: animeIds.map(x => Number(x)) });
        });
      } else {
        return res.json({ success: true, animeIds: [] });
      }
    });
  });
});

app.get('/api/admin/featured', (req, res) => {
  db.all(`SELECT id FROM shows WHERE featured = 1`, [], (err, rows) => {
    if (err) {
      console.error('Error fetching featured IDs:', err);
      return res.status(500).json({ message: 'Database error' });
    }
    const featuredIds = rows.map(r => r.id);
    return res.json({ animeIds: featuredIds });
  });
});

// ─── PUBLIC AVATARS & TICKER ROUTES ─────────────────────────────────────────
app.use('/api/avatars', avatarRoutes);
app.use('/api/ticker',  tickerRoutes);

// ─── PUBLIC SHOW DETAIL ROUTE ────────────────────────────────────────────────
// This lives here so it does not collide with the “/:showId” below.
app.get('/api/anime/:showId', (req, res) => {
  const showId = req.params.showId;

  // 1) fetch the show record (including genres + movieUrl)
  const showSql = `
    SELECT
      s.id,
      s.title,
      s.releaseDate,
      s.description,
      s.status,
      s.type,
      s.thumbnail,
      s.banner_url AS bannerUrl,
      GROUP_CONCAT(g.name) AS genreNames,
      m.videoUrl
    FROM shows s
    LEFT JOIN show_genres sg ON sg.showId = s.id
    LEFT JOIN genres g       ON g.id     = sg.genreId
    LEFT JOIN movie_urls m   ON m.showId = s.id
    WHERE s.id = ?
    GROUP BY s.id
  `;
  db.get(showSql, [showId], (err, showRow) => {
    if (err) {
      console.error('Detail DB error:', err);
      return res.status(500).json({ message: err.message });
    }
    if (!showRow) {
      return res.status(404).json({ message: 'Show not found' });
    }

    showRow.genre = showRow.genreNames
      ? showRow.genreNames.split(',')
      : [];

    // 2) fetch episodes
    const epsSql = `
      SELECT
        seasonNumber,
        episodeNumber,
        episodeTitle,
        videoUrl
      FROM episodes
      WHERE showId = ?
      ORDER BY seasonNumber, episodeNumber
    `;
    db.all(epsSql, [showId], (err2, rows) => {
      if (err2) {
        console.warn('Episodes query error, returning empty seasons:', err2);
        return res.json({ show: showRow, seasons: [] });
      }

      // 3) group into seasons
      const seasonsMap = {};
      rows.forEach(r => {
        if (!seasonsMap[r.seasonNumber]) {
          seasonsMap[r.seasonNumber] = {
            seasonNumber: r.seasonNumber,
            seasonTitle:  `Season ${r.seasonNumber}`,
            episodes:     []
          };
        }
        seasonsMap[r.seasonNumber].episodes.push({
          seasonNumber:  r.seasonNumber,
          episodeNumber: r.episodeNumber,
          episodeTitle:  r.episodeTitle,
          videoUrl:      r.videoUrl
        });
      });

      res.json({
        show:    showRow,
        seasons: Object.values(seasonsMap)
      });
    });
  });
});

// ─── PUBLIC ANIME ROUTES (list all / featured) ───────────────────────────────
// 1) GET /api/anime  (list all shows, including `featured` field)
app.get('/api/anime', (req, res) => {
  const sql = `
    SELECT
      s.id,
      s.title,
      s.thumbnail,
      s.releaseDate,
      s.status,
      s.type,
      s.banner_url        AS bannerUrl,
      s.featured,                      -- <— INCLUDE featured here!
      GROUP_CONCAT(g.name) AS genreNames,
      m.videoUrl          AS videoUrl
    FROM shows s
    LEFT JOIN show_genres sg ON sg.showId = s.id
    LEFT JOIN genres g       ON g.id     = sg.genreId
    LEFT JOIN movie_urls m   ON m.showId = s.id
    GROUP BY s.id
    ORDER BY s.title
  `;
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error('Error querying shows:', err);
      return res.status(500).json({ message: 'Database error' });
    }
    const shows = rows.map(r => ({
      id:          r.id,
      title:       r.title,
      thumbnail:   r.thumbnail,
      releaseDate: r.releaseDate,
      status:      r.status,
      type:        r.type,
      bannerUrl:   r.bannerUrl,
      featured:    r.featured,           // <— now front-end can see “0” vs “1”
      genre:       r.genreNames ? r.genreNames.split(',') : [],
      videoUrl:    r.videoUrl || null
    }));
    // Optional: filter by ?type=Movie or &type=TV
    if (req.query.type) {
      return res.json(shows.filter(s => s.type === req.query.type));
    }
    res.json(shows);
  });
});

// 2) GET /api/anime/featured  (returns only featured rows)
app.get('/api/anime/featured', (req, res) => {
  const sql = `
    SELECT
      s.id,
      s.title,
      s.description,
      COALESCE(s.banner_url, s.thumbnail) AS image_url,
      m.videoUrl AS videoUrl
    FROM shows s
    LEFT JOIN movie_urls m ON m.showId = s.id
    WHERE s.featured = 1
    ORDER BY s.title
  `;
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error('Error fetching featured:', err);
      return res.status(500).json({ message: 'Database error' });
    }
    // This returns an array of { id, title, description, image_url, videoUrl }
    res.json(rows);
  });
});

// ─── MOUNT OTHER ROUTES ─────────────────────────────────────────────────────
app.use('/api/comments', commentRoutes);

// ─── MOUNT ADMIN ROUTES ─────────────────────────────────────────────────────
app.use('/api/admin',    adminRoutes);

// ─── MOUNT THE NEW ROLES ROUTES ─────────────────────────────────────────────
app.use('/api/admin/roles', rolesRoutes);

// ─── SERVE ADMIN PANEL HTML ─────────────────────────────────────────────────
app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ─── STATIC ASSETS ──────────────────────────────────────────────────────────
app.use('/data', express.static(path.join(__dirname, 'data')));
app.use(express.static(path.join(__dirname, 'public')));

// ─── START THE SERVER ───────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`AnimeWatch server running at http://localhost:${PORT}`);
});
