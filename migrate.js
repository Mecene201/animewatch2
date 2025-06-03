// migrate.js
const path   = require('path');
const sqlite = require('sqlite3').verbose();

const db = new sqlite.Database(path.join(__dirname, 'data', 'anime.db'));
db.serialize(() => {
  // ─── SHOWS ───────────────────────────────────────────────────────
  db.run(`DROP TABLE IF EXISTS shows`);
  db.run(`CREATE TABLE shows (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT    NOT NULL,
    releaseDate TEXT,
    description TEXT,
    status      TEXT,
    type        TEXT,
    thumbnail   TEXT,
    banner_url  TEXT,
    featured    INTEGER DEFAULT 0
  )`);

  // ─── GENRES & RELATION ──────────────────────────────────────────
  db.run(`DROP TABLE IF EXISTS genres`);
  db.run(`CREATE TABLE genres (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
  )`);
  db.run(`DROP TABLE IF EXISTS show_genres`);
  db.run(`CREATE TABLE show_genres (
    showId  INTEGER NOT NULL,
    genreId INTEGER NOT NULL,
    FOREIGN KEY(showId)  REFERENCES shows(id) ON DELETE CASCADE,
    FOREIGN KEY(genreId) REFERENCES genres(id) ON DELETE CASCADE
  )`);

  // ─── MOVIE URL ──────────────────────────────────────────────────
  db.run(`DROP TABLE IF EXISTS movie_urls`);
  db.run(`CREATE TABLE movie_urls (
    showId   INTEGER PRIMARY KEY,
    videoUrl TEXT,
    FOREIGN KEY(showId) REFERENCES shows(id) ON DELETE CASCADE
  )`);

  // ─── SEASONS & EPISODES ────────────────────────────────────────
  db.run(`DROP TABLE IF EXISTS seasons`);
  db.run(`CREATE TABLE seasons (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    showId        INTEGER NOT NULL,
    seasonNumber  INTEGER NOT NULL,
    seasonTitle   TEXT,
    FOREIGN KEY(showId) REFERENCES shows(id) ON DELETE CASCADE
  )`);
  db.run(`DROP TABLE IF EXISTS episodes`);
  db.run(`CREATE TABLE episodes (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    showId         INTEGER NOT NULL,
    seasonNumber   INTEGER NOT NULL,
    episodeNumber  INTEGER NOT NULL,
    episodeTitle   TEXT,
    videoUrl       TEXT,
    FOREIGN KEY(showId) REFERENCES shows(id) ON DELETE CASCADE
  )`);

  // ─── AVATARS ────────────────────────────────────────────────────
  db.run(`DROP TABLE IF EXISTS avatars`);
  db.run(`CREATE TABLE avatars (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    url         TEXT    NOT NULL,
    name        TEXT,
    is_premium  INTEGER DEFAULT 0,
    cost        INTEGER DEFAULT 0
  )`);

  // ─── COMMENTS ───────────────────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS comments (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id      INTEGER NOT NULL,
      show_id      INTEGER NOT NULL,
      comment_text TEXT    NOT NULL,
      parent_id    INTEGER,
      created_at   TEXT    DEFAULT CURRENT_TIMESTAMP,
      edited_at    TEXT,
      FOREIGN KEY(user_id)   REFERENCES users(id)    ON DELETE CASCADE,
      FOREIGN KEY(show_id)   REFERENCES shows(id)    ON DELETE CASCADE,
      FOREIGN KEY(parent_id) REFERENCES comments(id) ON DELETE CASCADE
    )
  `);

  // ─── COMMENT REACTIONS ──────────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS comment_reactions (
      user_id    INTEGER NOT NULL,
      comment_id INTEGER NOT NULL,
      type       INTEGER NOT NULL,  -- 1 = like, -1 = dislike
      PRIMARY KEY (user_id, comment_id),
      FOREIGN KEY (user_id)    REFERENCES users(id),
      FOREIGN KEY (comment_id) REFERENCES comments(id)
    )
  `);

  // (repeat for users table etc. if needed)
});
db.close(() => console.log('Migration complete!'));
