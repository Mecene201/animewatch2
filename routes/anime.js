// routes/anime.js
const express  = require('express');
const path     = require('path');
const sqlite3  = require('sqlite3').verbose();
const router   = express.Router();

const db = new sqlite3.Database(
  path.join(__dirname, '..', 'data', 'anime.db'),
  err => { if (err) console.error('SQLite open error:', err); }
);

/* ────────────────────────────────────────────────────────────────────────────
   1) GET /api/anime
      • Returns an array of every row in "shows"
      • Each object has: { id, title, releaseDate, description, status, type,
                          thumbnail, bannerUrl, featured, genre (array), movieUrl }

   This allows your front‐end to do fetch('/api/anime') and see which
   ones have featured = 1 (or 0). 
──────────────────────────────────────────────────────────────────────────── */
router.get('/', (req, res) => {
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
    ORDER BY s.title;
  `;
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error('Error fetching /api/anime:', err);
      return res.status(500).json({ message: 'Database error' });
    }
    // Convert each row into the shape your front‐end expects
    const list = rows.map(r => ({
      id:          r.id,
      title:       r.title,
      releaseDate: r.releaseDate,
      description: r.description,
      status:      r.status,
      type:        r.type,
      thumbnail:   r.thumbnail,
      bannerUrl:   r.bannerUrl,
      featured:    r.featured,            // integer 0 or 1
      genre:       r.genres ? r.genres.split(',') : [],
      movieUrl:    r.movieUrl || null
    }));
    res.json(list);
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   2) GET /api/anime/featured
      • Returns an object { featured: [ … ] }, where each item has:
        { id, title, releaseDate, description, status, type, thumbnail, bannerUrl, featured }
      • Only includes rows where featured = 1 
──────────────────────────────────────────────────────────────────────────── */
router.get('/featured', (req, res) => {
  const sql = `
    SELECT
      s.id,
      s.title,
      s.releaseDate,
      s.description,
      s.status,
      s.type,
      s.thumbnail,
      s.banner_url AS bannerUrl,
      s.featured
    FROM shows s
    WHERE s.featured = 1
    ORDER BY s.title;
  `;
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error('Error fetching /api/anime/featured:', err);
      return res.status(500).json({ message: 'Database error' });
    }
    // Wrap the array in { featured: […] }
    res.json({ featured: rows.map(r => ({
      id:          r.id,
      title:       r.title,
      releaseDate: r.releaseDate,
      description: r.description,
      status:      r.status,
      type:        r.type,
      thumbnail:   r.thumbnail,
      bannerUrl:   r.bannerUrl,
      featured:    r.featured
    })) });
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   3) GET /api/anime/:showId
      • Returns { show: { … }, seasons: [ … ] }
      • Exactly as before, but reading from "shows" instead of "anime"
──────────────────────────────────────────────────────────────────────────── */
router.get('/:showId', (req, res) => {
  const showId = +req.params.showId;

  // 1) Fetch the show row from "shows"
  const showSql = `
    SELECT
      id,
      title,
      releaseDate,
      description,
      status,
      type,
      thumbnail,
      banner_url AS bannerUrl,
      featured
    FROM shows
    WHERE id = ?
  `;
  db.get(showSql, [showId], (err, showRow) => {
    if (err) {
      console.error(`Error fetching show ${showId}:`, err);
      return res.status(500).json({ message: 'Database error' });
    }
    if (!showRow) {
      return res.status(404).json({ message: 'Show not found' });
    }

    // 2) If it’s a movie, return immediately (no seasons/episodes)
    if (showRow.type === 'Movie') {
      return res.json({ show: showRow, seasons: [] });
    }

    // 3) Otherwise fetch seasons for this show
    db.all(
      `SELECT seasonNumber, seasonTitle
         FROM seasons
        WHERE showId = ?
        ORDER BY seasonNumber;`,
      [showId],
      (errSeasons, seasonsRows) => {
        if (errSeasons) {
          console.error(`Error fetching seasons for ${showId}:`, errSeasons);
          return res.status(500).json({ message: 'Database error' });
        }

        // 4) Fetch episodes
        db.all(
          `SELECT seasonNumber, episodeNumber, episodeTitle, videoUrl
             FROM episodes
            WHERE showId = ?
            ORDER BY seasonNumber, episodeNumber;`,
          [showId],
          (errEps, episodeRows) => {
            if (errEps) {
              console.error(`Error fetching episodes for ${showId}:`, errEps);
              return res.status(500).json({ message: 'Database error' });
            }

            // 5) Group episodes into each season
            const seasonsMap = {};
            // Pre‐seed real seasons
            seasonsRows.forEach(s => {
              seasonsMap[s.seasonNumber] = {
                seasonNumber: s.seasonNumber,
                seasonTitle:  s.seasonTitle || '',
                episodes:     []
              };
            });
            // Assign every episode to its season
            episodeRows.forEach(ep => {
              if (!seasonsMap[ep.seasonNumber]) {
                seasonsMap[ep.seasonNumber] = {
                  seasonNumber: ep.seasonNumber,
                  seasonTitle:  '',
                  episodes:     []
                };
              }
              seasonsMap[ep.seasonNumber].episodes.push({
                seasonNumber:  ep.seasonNumber,
                episodeNumber: ep.episodeNumber,
                episodeTitle:  ep.episodeTitle,
                videoUrl:      ep.videoUrl
              });
            });
            // Convert map → sorted array
            const nested = Object.values(seasonsMap)
              .sort((a, b) => a.seasonNumber - b.seasonNumber);

            res.json({ show: showRow, seasons: nested });
          }
        );
      }
    );
  });
});

module.exports = router;




