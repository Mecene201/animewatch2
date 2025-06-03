// scripts/resetDb.js
const fs      = require('fs');
const path    = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, '..', 'data', 'anime.db');

// 1) Delete existing file (if it exists)
if (fs.existsSync(DB_PATH)) {
  console.log('Deleting existing anime.db…');
  fs.unlinkSync(DB_PATH);
}

// 2) Open new database (this will create a fresh file)
const db = new sqlite3.Database(DB_PATH, err => {
  if (err) return console.error('Failed to create DB:', err);
  console.log('Created new anime.db');
});

// 3) Create your tables from scratch
db.serialize(() => {
  // Shows
  db.run(`
    CREATE TABLE IF NOT EXISTS shows (
      id           INTEGER PRIMARY KEY,
      title        TEXT,
      releaseDate  TEXT,
      description  TEXT,
      status       TEXT,
      type         TEXT,
      thumbnail    TEXT,
      banner_url   TEXT,
      featured     INTEGER DEFAULT 0
    );
  `);

  // Genres
  db.run(`
    CREATE TABLE IF NOT EXISTS genres (
      id   INTEGER PRIMARY KEY,
      name TEXT UNIQUE
    );
  `);

  // Show-Genres join
  db.run(`
    CREATE TABLE IF NOT EXISTS show_genres (
      showId  INTEGER,
      genreId INTEGER,
      FOREIGN KEY(showId ) REFERENCES shows(id) ON DELETE CASCADE,
      FOREIGN KEY(genreId) REFERENCES genres(id) ON DELETE CASCADE
    );
  `);

  // Seasons
  db.run(`
    CREATE TABLE IF NOT EXISTS seasons (
      id            INTEGER PRIMARY KEY,
      showId        INTEGER,
      season_number INTEGER,
      season_title  TEXT,
      FOREIGN KEY(showId) REFERENCES shows(id) ON DELETE CASCADE
    );
  `);

  // Episodes
  db.run(`
    CREATE TABLE IF NOT EXISTS episodes (
      id              INTEGER PRIMARY KEY,
      showId          INTEGER,
      season_number   INTEGER,
      episode_number  INTEGER,
      episode_title   TEXT,
      videoUrl        TEXT,
      FOREIGN KEY(showId) REFERENCES shows(id) ON DELETE CASCADE
    );
  `);

  // Movie URLs
  db.run(`
    CREATE TABLE IF NOT EXISTS movie_urls (
      showId   INTEGER PRIMARY KEY,
      videoUrl TEXT,
      FOREIGN KEY(showId) REFERENCES shows(id) ON DELETE CASCADE
    );
  `);

  // Avatars
  db.run(`
    CREATE TABLE IF NOT EXISTS avatars (
      id         INTEGER PRIMARY KEY,
      url        TEXT,
      name       TEXT,
      is_premium INTEGER DEFAULT 0,
      cost       INTEGER DEFAULT 0
    );
  `);

  // Users (for coins)
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id       INTEGER PRIMARY KEY,
      username TEXT UNIQUE,
      coins    INTEGER DEFAULT 0,
      isAdmin  INTEGER DEFAULT 0
    );
  `);

  console.log('All tables created.');
});

db.close(() => {
  console.log('Database reset complete.');
});
