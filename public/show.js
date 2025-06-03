// public/show.js
document.addEventListener('DOMContentLoaded', async () => {
  // ─── Helpers ───────────────────────────────────────────────────────────────
  function makeSlug(str) {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function relativeTime(ts) {
    const now = Date.now(),
          then = new Date(ts).getTime(),
          d = Math.floor((now - then) / 1000);
    if (d < 5)   return 'just now';
    if (d < 60)  return `${d}s ago`;
    const m = Math.floor(d / 60);
    if (m < 60)  return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24)  return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  // ─── Read URL params ────────────────────────────────────────────────────────
  const params     = new URLSearchParams(window.location.search);
  const showId     = parseInt(params.get('showId'), 10);
  const urlSeason  = params.get('season');
  const urlEpisode = params.get('episode');

  if (!showId) {
    console.error('No showId in URL');
    return;
  }

  // ─── Elements ───────────────────────────────────────────────────────────────
  const pageTitle      = document.getElementById('page-title');
  const thumb          = document.getElementById('show-thumbnail');
  const titleEl        = document.getElementById('show-title');
  const descEl         = document.getElementById('show-description');
  const metaEl         = document.getElementById('showMeta');
  const tabsEl         = document.getElementById('seasonTabs');
  const listEl         = document.getElementById('episodes-list');
  const playerFrame    = document.getElementById('videoFrame');
  const genreContainer = document.getElementById('genreList');

  const commentsSection = document.getElementById('comments-section');
  const commentsList    = document.getElementById('comments-list');
  const formContainer   = document.getElementById('comment-form-container');
  const loginPrompt     = document.getElementById('login-prompt');
  const commentInput    = document.getElementById('comment-input');
  const submitBtn       = document.getElementById('submit-comment');
  const loginForm       = document.getElementById('loginForm');
  const registerForm    = document.getElementById('registerForm');
  const loginMsg        = document.getElementById('loginMsg');
  const regMsg          = document.getElementById('regMsg');
  const loginUsername   = document.getElementById('loginUsername');
  const loginPassword   = document.getElementById('loginPassword');
  const regUsername     = document.getElementById('regUsername');
  const regPassword     = document.getElementById('regPassword');
  const regConfirm      = document.getElementById('regConfirm');
  const logoutLink      = document.getElementById('logoutLink');
  const loginLink       = document.getElementById('loginLink');

  let currentUserId = null;
  let sort          = 'newest';
  let page          = 1;
  const pageSize    = 10;

  // ─── Fetch show data ────────────────────────────────────────────────────────
  let show, dedupedSeasons;
  try {
    const res = await fetch(`/api/anime/${showId}`);
    if (!res.ok) throw new Error('Show not found');
    const data = await res.json();
    show    = data.show    || {};
    const seasons = data.seasons || [];

    // Deduplicate seasons & episodes
    const mapS = new Map();
    seasons.forEach(s => {
      if (!mapS.has(s.seasonNumber)) {
        const seenE = new Set();
        const eps = [];
        (s.episodes || []).forEach(ep => {
          if (!seenE.has(ep.episodeNumber)) {
            seenE.add(ep.episodeNumber);
            eps.push(ep);
          }
        });
        mapS.set(s.seasonNumber, {
          seasonNumber: s.seasonNumber,
          seasonTitle:  s.seasonTitle || `Season ${s.seasonNumber}`,
          episodes:     eps
        });
      }
    });
    dedupedSeasons = Array.from(mapS.values());
  } catch (err) {
    console.error('Error fetching show:', err);
    titleEl.textContent = 'Error loading show';
    return;
  }

  // ─── Generate slug & rewrite URL ────────────────────────────────────────────
  const slug = makeSlug(show.title);
  {
    const newParams = new URLSearchParams();
    newParams.set('show', slug);
    newParams.set('showId', String(showId));
    if (urlSeason)  newParams.set('season', urlSeason);
    if (urlEpisode) newParams.set('episode', urlEpisode);
    history.replaceState(null, '', `show.html?${newParams.toString()}`);
  }

  // ─── Populate show info ─────────────────────────────────────────────────────
  pageTitle.textContent = `AnimeWatch – ${show.title}`;
  document.title       = `AnimeWatch – ${show.title}`;

  thumb.src = show.thumbnail || '';
  titleEl.textContent = show.title;
  descEl.textContent  = show.description || '';

  const dt = show.releaseDate
    ? new Date(show.releaseDate).toLocaleDateString()
    : '';
  metaEl.innerHTML = `
    <p><span class="meta-label">Release Date:</span>${dt}</p>
    <p><span class="meta-label">Status:</span>${show.status || ''}</p>
  `;

  // Populate genres
  if (Array.isArray(show.genre) && show.genre.length > 0) {
    genreContainer.innerHTML = '';
    show.genre.forEach((g, idx) => {
      const link = document.createElement('a');
      link.href = `index.html?genre=${encodeURIComponent(g)}`;
      link.textContent = g;
      genreContainer.appendChild(link);
      if (idx < show.genre.length - 1) {
        genreContainer.appendChild(document.createTextNode(' '));
      }
    });
  } else {
    genreContainer.innerHTML = '<span style="color:#bbb;">None</span>';
  }

  // ─── Video helper ───────────────────────────────────────────────────────────
  function toEmbed(u) {
    const m = u.match(/streamtape\.com\/[ev]\/([^/?]+)/);
    return m ? `https://streamtape.com/e/${m[1]}` : u;
  }
  function loadVideo(u) {
    playerFrame.src = toEmbed(u);
  }

  // ─── Render Series/Movie ────────────────────────────────────────────────────
  if (show.type === 'Movie' && show.videoUrl) {
    tabsEl.style.display = 'none';
    listEl.innerHTML = `<li class="playing">
      <a href="#" id="movieEntry">${show.title}</a>
    </li>`;
    document.getElementById('movieEntry').onclick = e => {
      e.preventDefault();
      loadVideo(show.videoUrl);
    };
    loadVideo(show.videoUrl);

  } else {
    // Determine initial season index from URL
    let currentSeasonIdx = 0;
    if (urlSeason) {
      const idx = dedupedSeasons.findIndex(
        s => String(s.seasonNumber) === urlSeason
      );
      if (idx !== -1) currentSeasonIdx = idx;
    }
    let currentEpisodeNum = urlEpisode || null;

    function renderTabs() {
      tabsEl.innerHTML = '';
      dedupedSeasons.forEach((s, i) => {
        const btn = document.createElement('button');
        btn.className = 'season-tab' + (i === currentSeasonIdx ? ' active' : '');
        btn.textContent = s.seasonTitle;
        btn.onclick = () => {
          if (i === currentSeasonIdx) return;
          currentSeasonIdx = i;
          currentEpisodeNum = null;
          updateURL();
          renderTabs();
          renderEps();
        };
        tabsEl.appendChild(btn);
      });
    }

    function renderEps() {
      listEl.innerHTML = '';
      const seasonObj = dedupedSeasons[currentSeasonIdx];
      seasonObj.episodes.forEach(ep => {
        const li = document.createElement('li');
        const a  = document.createElement('a');
        a.href = `show.html?show=${slug}&showId=${showId}&season=${seasonObj.seasonNumber}&episode=${ep.episodeNumber}`;
        a.textContent = `${ep.episodeNumber}. ${ep.episodeTitle}`;
        a.onclick = e => {
          e.preventDefault();
          listEl.querySelectorAll('li').forEach(x => x.classList.remove('playing'));
          li.classList.add('playing');
          currentEpisodeNum = String(ep.episodeNumber);
          updateURL();
          loadVideo(ep.videoUrl);
        };
        li.appendChild(a);
        if (String(ep.episodeNumber) === currentEpisodeNum) {
          li.classList.add('playing');
        }
        listEl.appendChild(li);
      });
    }

    function updateURL() {
      const newParams = new URLSearchParams();
      newParams.set('show', slug);
      newParams.set('showId', String(showId));
      newParams.set('season', dedupedSeasons[currentSeasonIdx].seasonNumber);
      if (currentEpisodeNum) newParams.set('episode', currentEpisodeNum);
      history.pushState(null, '', `show.html?${newParams.toString()}`);
    }

    // Initial render
    renderTabs();
    // If URL episode is invalid or missing, default to first
    const seasonObj = dedupedSeasons[currentSeasonIdx];
    if (!currentEpisodeNum ||
        !seasonObj.episodes.some(e => String(e.episodeNumber) === currentEpisodeNum)) {
      currentEpisodeNum = seasonObj.episodes[0]?.episodeNumber
        ? String(seasonObj.episodes[0].episodeNumber)
        : null;
      updateURL();
    }
    renderEps();
    if (currentEpisodeNum) {
      const epObj = seasonObj.episodes.find(e => String(e.episodeNumber) === currentEpisodeNum);
      if (epObj) loadVideo(epObj.videoUrl);
    }
  }

  // ─── Toggle description ─────────────────────────────────────────────────────
  const toggleDescBtn = document.querySelector('.toggle-description');
  if (toggleDescBtn) {
    toggleDescBtn.onclick = e => {
      const expanded = descEl.classList.toggle('expanded');
      e.target.textContent = expanded ? 'Show less' : 'Read more';
    };
  }

  // ─── Comments & Auth ───────────────────────────────────────────────────────
  const controls = document.createElement('div');
  controls.className = 'comment-controls';
  controls.innerHTML = `
    <select id="commentSort">
      <option value="newest">🔽 Newest</option>
      <option value="oldest">🔼 Oldest</option>
      <option value="top">⭐ Top</option>
    </select>
    <button id="prevPage">«</button>
    <span id="pageIndicator">Page 1</span>
    <button id="nextPage">»</button>
  `;
  commentsSection.insertBefore(controls, commentsList);
  const sortSelect = controls.querySelector('#commentSort');
  const prevBtn    = controls.querySelector('#prevPage');
  const nextBtn    = controls.querySelector('#nextPage');
  const pageInd    = controls.querySelector('#pageIndicator');
  sortSelect.onchange = () => { sort = sortSelect.value; page = 1; loadComments(); };
  prevBtn.onclick     = () => { if (page > 1) { page--; loadComments(); } };
  nextBtn.onclick     = () => { page++; loadComments(); };

  async function handleLogin(e) {
    e.preventDefault();
    loginMsg.textContent = '';
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: loginUsername.value.trim(),
        password: loginPassword.value.trim()
      })
    });
    const data = await res.json();
    if (!res.ok) {
      loginMsg.textContent = data.message || 'Login failed';
      return;
    }
    document.getElementById('loginModal').classList.remove('active');
    setLoggedInState();
  }
  async function handleRegister(e) {
    e.preventDefault();
    regMsg.textContent = '';
    if (regPassword.value !== regConfirm.value) {
      regMsg.textContent = 'Passwords must match';
      return;
    }
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: regUsername.value.trim(),
        password: regPassword.value.trim()
      })
    });
    const data = await res.json();
    if (!res.ok) {
      regMsg.textContent = data.message || 'Registration failed';
      return;
    }
    document.getElementById('registerModal').classList.remove('active');
    setLoggedInState();
  }
  loginForm.addEventListener('submit', handleLogin);
  registerForm.addEventListener('submit', handleRegister);
  logoutLink?.addEventListener('click', async e => {
    e.preventDefault();
    await fetch('/api/auth/logout', { method: 'POST' });
    setLoggedOutState();
  });
  loginLink?.addEventListener('click', e => {
    e.preventDefault();
    document.getElementById('loginModal').classList.add('active');
  });

  function setLoggedInState() {
    loginPrompt.style.display   = 'none';
    formContainer.style.display = 'block';
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(u => { currentUserId = u.user.id; loadComments(); })
      .catch(() => {});
  }
  function setLoggedOutState() {
    currentUserId = null;
    formContainer.style.display = 'none';
    loginPrompt.style.display   = 'block';
    loadComments();
  }

  fetch('/api/auth/me')
    .then(r => r.ok ? r.json().then(setLoggedInState) : setLoggedOutState())
    .catch(setLoggedOutState);

  submitBtn.addEventListener('click', () => {
    const text = commentInput.value.trim();
    if (!text) return;
    fetch(`/api/comments/${showId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment_text: text })
    })
    .then(r => r.ok ? (commentInput.value = '', page = 1, loadComments()) : Promise.reject())
    .catch(() => alert('Failed to post comment'));
  });

  function loadComments() {
    fetch(`/api/comments/${showId}?sort=${sort}&page=${page}&pageSize=${pageSize}`)
      .then(r => r.json())
      .then(data => {
        commentsList.innerHTML = '';
        prevBtn.disabled = data.page <= 1;
        nextBtn.disabled = data.comments.length < pageSize;
        pageInd.textContent = `Page ${data.page}`;
        renderComments(buildTree(data.comments), commentsList, 0);
      })
      .catch(() => {
        commentsList.innerHTML = '<li>Error loading comments.</li>';
      });
  }

  function buildTree(comments) {
    const map = {}, roots = [];
    comments.forEach(c => { c.children = []; map[c.id] = c; });
    comments.forEach(c => {
      if (c.parent_id && map[c.parent_id]) map[c.parent_id].children.push(c);
      else roots.push(c);
    });
    return roots;
  }

  function renderComments(nodes, container, depth) {
    nodes.forEach(c => {
      const li = document.createElement('li');
      li.style.marginLeft = `${depth * 20}px`;
      li.className = 'comment-item';
      const avatar = c.avatarUrl || '/default-avatar.png';
      li.innerHTML = `
        <img class="comment-avatar" src="${avatar}" alt="${c.username}">
        <div class="comment-content">
          <div class="comment-header">
            <span class="comment-username">${c.username}</span>
            <small class="comment-time">${relativeTime(c.created_at)}</small>
          </div>
          <p class="comment-text">${c.comment_text}</p>
          <div class="comment-actions">
            <button class="like-btn">👍 ${c.likeCount}</button>
            <button class="dislike-btn">👎 ${c.dislikeCount || 0}</button>
            <button class="reply-btn">Reply</button>
            ${c.user_id === currentUserId
              ? '<button class="edit-btn">Edit</button><button class="delete-btn">Delete</button>'
              : ''}
          </div>
        </div>
      `;
      container.appendChild(li);
      li.querySelector('.like-btn').onclick    = () => fetch(`/api/comments/${c.id}/like`,   { method: 'POST' }).then(loadComments);
      li.querySelector('.dislike-btn').onclick = () => fetch(`/api/comments/${c.id}/dislike`,{ method: 'POST' }).then(loadComments);
      li.querySelector('.reply-btn').onclick   = () => showReplyForm(c.id, li, depth + 1);
      if (c.user_id === currentUserId) {
        li.querySelector('.delete-btn').onclick = () => fetch(`/api/comments/${c.id}`, { method: 'DELETE' }).then(loadComments);
        li.querySelector('.edit-btn').onclick   = () => showEditForm(c.id, c.comment_text, li);
      }
      if (c.children.length) {
        const toggle = document.createElement('a');
        toggle.href = '#';
        toggle.textContent = `+${c.children.length} replies`;
        const box = document.createElement('div');
        box.style.display = 'none';
        toggle.onclick = e => {
          e.preventDefault();
          const open = box.style.display === 'block';
          box.style.display = open ? 'none' : 'block';
          toggle.textContent = open ? `+${c.children.length} replies` : '– hide replies';
          if (!open) renderComments(c.children, box, depth + 1);
          else box.innerHTML = '';
        };
        li.appendChild(toggle);
        li.appendChild(box);
      }
    });
  }

  function showReplyForm(pid, li, depth) {
    if (li.querySelector('.reply-form')) return;
    const form = document.createElement('div');
    form.className = 'reply-form';
    form.style.marginLeft = `${depth * 20}px`;
    form.innerHTML = `<textarea rows="2"></textarea><button>Submit</button><button>Cancel</button>`;
    li.appendChild(form);
    const [ta, sb, cb] = form.querySelectorAll('textarea,button');
    cb.onclick = () => form.remove();
    sb.onclick = () => {
      const t = ta.value.trim(); if (!t) return;
      fetch(`/api/comments/${showId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment_text: t, parent_id: pid })
      })
      .then(r => r.ok ? loadComments() : Promise.reject())
      .catch(() => alert('Reply failed'));
    };
  }

  function showEditForm(cid, txt, li) {
    if (li.querySelector('.edit-form')) return;
    const p = li.querySelector('p.comment-text');
    p.style.display = 'none';
    const form = document.createElement('div');
    form.className = 'edit-form';
    form.innerHTML = `<textarea rows="3">${txt}</textarea><button>Save</button><button>Cancel</button>`;
    li.appendChild(form);
    const [ta, sv, cb] = form.querySelectorAll('textarea,button');
    cb.onclick = () => { form.remove(); p.style.display = ''; };
    sv.onclick = () => {
      const t = ta.value.trim(); if (!t) return;
      fetch(`/api/comments/${cid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment_text: t })
      })
      .then(r => r.ok ? loadComments() : Promise.reject())
      .catch(() => alert('Edit failed'));
    };
  }
});



