// routes/comments.js
const express  = require('express');
const path     = require('path');
const sqlite3  = require('sqlite3').verbose();
const router   = express.Router();

const db = new sqlite3.Database(
  path.join(__dirname, '..', 'data', 'anime.db'),
  err => { if (err) console.error('SQLite open error:', err); }
);

// ─── Ensure the unified reactions table exists ─────────────────────────────
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS comment_reactions (
      user_id    INTEGER,
      comment_id INTEGER,
      type       INTEGER,  -- 1 = like, -1 = dislike
      PRIMARY KEY (user_id, comment_id),
      FOREIGN KEY (user_id)    REFERENCES users(id),
      FOREIGN KEY (comment_id) REFERENCES comments(id)
    );
  `);
});

// ─── Auth middleware ───────────────────────────────────────────────────────
function ensureAuthenticated(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'You must be logged in.' });
  }
  next();
}

// ─── FETCH COMMENTS ─────────────────────────────────────────────────────────
// GET /api/comments/:showId?sort=&page=&pageSize=
router.get('/:showId', (req, res) => {
  const showId   = +req.params.showId;
  const sort     = req.query.sort || 'newest';
  const page     = +(req.query.page || 1);
  const pageSize = +(req.query.pageSize || 10);
  const offset   = (page - 1) * pageSize;
  const userId   = req.session.user?.id || null;

  let orderBy = 'c.created_at DESC';
  if (sort === 'oldest') orderBy = 'c.created_at ASC';
  if (sort === 'top') {
    orderBy = `(SELECT COUNT(*) FROM comment_reactions cr WHERE cr.comment_id = c.id AND cr.type = 1) DESC`;
  }

  const sql = `
    SELECT
      c.id,
      c.comment_text,
      c.created_at,
      c.edited_at,
      c.parent_id,
      u.id           AS user_id,
      u.username,
      u.picture_url  AS avatarUrl,
      -- reactions
      (SELECT COUNT(*) FROM comment_reactions cr WHERE cr.comment_id = c.id AND cr.type = 1)  AS likeCount,
      EXISTS(SELECT 1 FROM comment_reactions cr WHERE cr.comment_id = c.id AND cr.user_id = ? AND cr.type = 1)  AS likedByMe,
      (SELECT COUNT(*) FROM comment_reactions cr WHERE cr.comment_id = c.id AND cr.type = -1) AS dislikeCount,
      EXISTS(SELECT 1 FROM comment_reactions cr WHERE cr.comment_id = c.id AND cr.user_id = ? AND cr.type = -1) AS dislikedByMe
    FROM comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.show_id = ?
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `;
  db.all(sql, [userId, userId, showId, pageSize, offset], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to fetch comments.' });
    }
    res.json({ comments: rows, page, pageSize });
  });
});

// ─── POST COMMENT / REPLY ───────────────────────────────────────────────────
router.post('/:showId', ensureAuthenticated, (req, res) => {
  const showId       = +req.params.showId;
  const userId       = req.session.user.id;
  const text         = (req.body.comment_text || '').trim();
  const parent_id    = req.body.parent_id ? +req.body.parent_id : null;
  if (!text) return res.status(400).json({ error: 'Cannot post empty comment.' });

  db.run(
    `INSERT INTO comments(show_id, user_id, comment_text, parent_id) VALUES(?,?,?,?)`,
    [showId, userId, text, parent_id],
    function(err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Failed to post comment.' });
      }
      const newId = this.lastID;
      db.get(
        `SELECT
           c.id, c.comment_text, c.created_at, c.edited_at, c.parent_id,
           u.id AS user_id, u.username, u.picture_url AS avatarUrl,
           0 AS likeCount, 0 AS likedByMe, 0 AS dislikeCount, 0 AS dislikedByMe
         FROM comments c
         JOIN users u ON c.user_id = u.id
         WHERE c.id = ?`,
        [newId],
        (e2, comment) => {
          if (e2) {
            console.error(e2);
            return res.status(500).json({ error: 'Posted but retrieval failed.' });
          }
          res.status(201).json(comment);
        }
      );
    }
  );
});

// ─── EDIT COMMENT ───────────────────────────────────────────────────────────
router.put('/:commentId', ensureAuthenticated, (req, res) => {
  const id   = +req.params.commentId;
  const user = req.session.user.id;
  const txt  = (req.body.comment_text || '').trim();
  if (!txt) return res.status(400).json({ error: 'Cannot be empty.' });

  db.get(`SELECT user_id FROM comments WHERE id = ?`, [id], (e, row) => {
    if (e) return res.status(500).json({ error: 'DB error.' });
    if (!row) return res.status(404).json({ error: 'Not found.' });
    if (row.user_id !== user) return res.status(403).json({ error: 'Not yours.' });

    const now = new Date().toISOString();
    db.run(`UPDATE comments SET comment_text=?, edited_at=? WHERE id=?`, [txt, now, id], err => {
      if (err) return res.status(500).json({ error: 'Update failed.' });

      // return updated plus reaction state:
      const sql = `
        SELECT
          c.id, c.comment_text, c.created_at, c.edited_at, c.parent_id,
          u.id AS user_id, u.username, u.picture_url AS avatarUrl,
          (SELECT COUNT(*) FROM comment_reactions cr WHERE cr.comment_id=c.id AND cr.type=1)  AS likeCount,
          EXISTS(SELECT 1 FROM comment_reactions cr WHERE cr.comment_id=c.id AND cr.user_id=? AND cr.type=1) AS likedByMe,
          (SELECT COUNT(*) FROM comment_reactions cr WHERE cr.comment_id=c.id AND cr.type=-1) AS dislikeCount,
          EXISTS(SELECT 1 FROM comment_reactions cr WHERE cr.comment_id=c.id AND cr.user_id=? AND cr.type=-1) AS dislikedByMe
        FROM comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.id = ?`;
      db.get(sql, [user, user, id], (e2, updated) => {
        if (e2) return res.status(500).json({ error: 'Fetch failed.' });
        res.json(updated);
      });
    });
  });
});

// ─── DELETE COMMENT & REPLIES ───────────────────────────────────────────────
router.delete('/:commentId', ensureAuthenticated, (req, res) => {
  const id   = +req.params.commentId;
  const user = req.session.user.id;

  db.get(`SELECT user_id FROM comments WHERE id = ?`, [id], (e, row) => {
    if (e) return res.status(500).json({ error: 'DB error.' });
    if (!row) return res.status(404).json({ error: 'Not found.' });
    if (row.user_id !== user) return res.status(403).json({ error: 'Not yours.' });

    const delReactions = `
      WITH RECURSIVE toDel(id) AS (
        SELECT id FROM comments WHERE id=?
        UNION ALL
        SELECT c.id FROM comments c JOIN toDel td ON c.parent_id=td.id
      )
      DELETE FROM comment_reactions WHERE comment_id IN (SELECT id FROM toDel);
    `;
    const delComments = `
      WITH RECURSIVE toDel(id) AS (
        SELECT id FROM comments WHERE id=?
        UNION ALL
        SELECT c.id FROM comments c JOIN toDel td ON c.parent_id=td.id
      )
      DELETE FROM comments WHERE id IN (SELECT id FROM toDel);
    `;
    db.run(delReactions, [id], err1 => {
      if (err1) return res.status(500).json({ error: 'Del reactions failed.' });
      db.run(delComments, [id], err2 => {
        if (err2) return res.status(500).json({ error: 'Del comments failed.' });
        res.json({ message: 'Deleted.' });
      });
    });
  });
});

// ─── TOGGLE LIKE ───────────────────────────────────────────────────────────
router.post('/:commentId/like', ensureAuthenticated, (req, res) => {
  const cid = +req.params.commentId;
  const uid = req.session.user.id;

  db.get(
    `SELECT type FROM comment_reactions WHERE user_id=? AND comment_id=?`,
    [uid, cid],
    (e, row) => {
      if (e) return res.status(500).json({ error: 'DB error.' });

      const newType = (row && row.type === 1) ? 0 : 1;
      const sql = newType
        ? `INSERT OR REPLACE INTO comment_reactions(user_id,comment_id,type) VALUES(?,?,1)`
        : `DELETE FROM comment_reactions WHERE user_id=? AND comment_id=?`;

      db.run(sql, [uid, cid], err1 => {
        if (err1) return res.status(500).json({ error: 'Toggle failed.' });

        db.get(
          `SELECT
             SUM(type=1)  AS likeCount,
             SUM(type=-1) AS dislikeCount,
             EXISTS(SELECT 1 FROM comment_reactions WHERE comment_id=? AND user_id=? AND type=1)  AS likedByMe,
             EXISTS(SELECT 1 FROM comment_reactions WHERE comment_id=? AND user_id=? AND type=-1) AS dislikedByMe
           FROM comment_reactions WHERE comment_id=?`,
          [cid, uid, cid, uid, cid],
          (e2, counts) => {
            if (e2) return res.status(500).json({ error: 'Count failed.' });
            res.json(counts);
          }
        );
      });
    }
  );
});

// ─── TOGGLE DISLIKE ────────────────────────────────────────────────────────
router.post('/:commentId/dislike', ensureAuthenticated, (req, res) => {
  const cid = +req.params.commentId;
  const uid = req.session.user.id;

  db.get(
    `SELECT type FROM comment_reactions WHERE user_id=? AND comment_id=?`,
    [uid, cid],
    (e, row) => {
      if (e) return res.status(500).json({ error: 'DB error.' });

      const newType = (row && row.type === -1) ? 0 : -1;
      const sql = newType
        ? `INSERT OR REPLACE INTO comment_reactions(user_id,comment_id,type) VALUES(?,?,-1)`
        : `DELETE FROM comment_reactions WHERE user_id=? AND comment_id=?`;

      db.run(sql, [uid, cid], err1 => {
        if (err1) return res.status(500).json({ error: 'Toggle failed.' });

        db.get(
          `SELECT
             SUM(type=1)  AS likeCount,
             SUM(type=-1) AS dislikeCount,
             EXISTS(SELECT 1 FROM comment_reactions WHERE comment_id=? AND user_id=? AND type=1)  AS likedByMe,
             EXISTS(SELECT 1 FROM comment_reactions WHERE comment_id=? AND user_id=? AND type=-1) AS dislikedByMe
           FROM comment_reactions WHERE comment_id=?`,
          [cid, uid, cid, uid, cid],
          (e2, counts) => {
            if (e2) return res.status(500).json({ error: 'Count failed.' });
            res.json(counts);
          }
        );
      });
    }
  );
});

module.exports = router;


