// public/loadHeader.js

// ──────────────────────────────────────────────────────────────────────────────
// Inject favicon into every page that loads this script
// ──────────────────────────────────────────────────────────────────────────────
;(function injectFavicon() {
  const link = document.createElement('link');
  link.rel  = 'icon';
  // Update this URL if your awlogo.png is hosted elsewhere:
  link.href = 'https://raw.githubusercontent.com/Mecene201/herobanner/main/awlogo.png';
  document.head.appendChild(link);
})();

// 1) Build header + (external) modals in a reusable function
async function buildHeader() {
  const headerEl = document.getElementById('site-header');
  if (!headerEl) return;

  // Fetch auth state
  let user = null;
  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) {
      const payload = await res.json();
      user = payload.user; // either an object or null
    }
  } catch {
    // silently ignore if auth check fails
  }

  // Build nav links array
  const links = [
    { href: '/',              text: 'Home' },
    { href: '/tv-shows.html', text: 'TV Shows' },
    { href: '/movies.html',   text: 'Movies' },
    // If user is signed in, show “Edit Profile”
    ...(user !== null
      ? [{ href: '/profile.html', id: 'editProfileLink', text: 'Edit Profile' }]
      : []),
    // Show “Admin” link if user.isAdmin === true or user.permissions is nonempty
    ...(user !== null &&
       (user.isAdmin === true ||
        (Array.isArray(user.permissions) && user.permissions.length > 0))
      ? [{ href: '/admin.html', id: 'adminLink', text: 'Admin' }]
      : []),
    // If user is exactly null (i.e., not logged in), show “Log In” + “Register”
    ...(user === null
      ? [
          { href: '#', id: 'loginLink',    text: 'Log In'   },
          { href: '#', id: 'registerLink', text: 'Register' }
        ]
      : [])
  ];

  // 2) Inject the header (with search + placeholders for genre & switch)
  headerEl.innerHTML = `
    <header class="site-header">
      <div class="container">
        <div class="header-left">
          <a href="/" class="logo">
            <img
              src="/assets/images/animewatch.png"
              alt="AnimeWatch Logo"
              class="site-logo"
            />
            <span class="logo-text">AnimeWatch</span>
          </a>
          <div class="search" style="position:relative;">
            <input
              id="searchInput"
              type="text"
              placeholder="Search…"
              autocomplete="off"
            />
            <button id="searchBtn">Go</button>
            <div
              id="searchResults"
              style="
                display:none;
                position:absolute;
                top:100%;
                left:0;
                right:0;
                background:#1e1e1e;
                border:1px solid #333;
                max-height:300px;
                overflow-y:auto;
                z-index:1000;
              "
            ></div>
          </div>

          <!-- ─── PLACEHOLDER for “Filter by Genre” dropdown -->
          <span id="genreFilterPlaceholder"></span>

          <!-- ─── PLACEHOLDER for “Anime?” switch -->
          <span id="rlSwitchPlaceholder"></span>
        </div>

        <nav>
          ${links
            .map(
              (l) =>
                `<a href="${l.href}" ${l.id ? `id="${l.id}"` : ''}>${l.text}</a>`
            )
            .join('')}

          ${
            user !== null
              ? `<span class="greet">
                   Hi, ${user.username} – ${user.coins} coins
                 </span>
                 <a href="#" id="logoutLink">Logout</a>`
              : ''
          }
        </nav>
      </div>
    </header>
  `;

  // 2a) Inject a simple hover‐highlight style for search items (once)
  if (!document.getElementById('searchResultsStyle')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'searchResultsStyle';
    styleEl.innerHTML = `
      #searchResults .result-item { transition: background .2s; }
      #searchResults .result-item:hover { background: #2a2a2a; }
    `;
    document.head.appendChild(styleEl);
  }

  // 3) After the nav links exist, insert the “Filter by Genre” UI
  insertGenreFilterIntoHeader();

  // 4) Insert the “Anime?” switch (next to genre dropdown)
  insertRlSwitchIntoHeader();

  // 5) “Go” button logic for live search
  document.getElementById('searchBtn').onclick = () => {
    const q = document.getElementById('searchInput').value.trim();
    if (q) window.location.href = `/?q=${encodeURIComponent(q)}`;
  };

  // 6) Live‐search logic
  const input = document.getElementById('searchInput');
  const resultsDiv = document.getElementById('searchResults');
  let allAnimeCache = null;

  input.addEventListener('input', async () => {
    const q = input.value.trim().toLowerCase();
    if (!q) {
      resultsDiv.style.display = 'none';
      return;
    }
    if (!allAnimeCache) {
      const res = await fetch('/api/anime');
      allAnimeCache = res.ok ? await res.json() : [];
    }
    const matches = allAnimeCache.filter((a) =>
      a.title.toLowerCase().includes(q)
    );
    let html = matches
      .slice(0, 5)
      .map(
        (a) => `
      <div
        class="result-item"
        onclick="location.href='/show.html?showId=${a.id}'"
        style="
          display:flex;
          align-items:center;
          padding:8px;
          border-bottom:1px solid #333;
          cursor:pointer;
        "
      >
        <img
          src="${a.thumbnail}"
          alt="${a.title}"
          style="
            height:50px;
            width:auto;
            object-fit:contain;
            margin-right:8px;
          "
        />
        <strong
          style="
            color:#eee;
            white-space:nowrap;
            overflow:hidden;
            text-overflow:ellipsis;
          "
        >
          ${a.title}
        </strong>
      </div>
    `
      )
      .join('');
    if (matches.length > 5) {
      html += `
        <div
          style="
            padding:8px;
            text-align:center;
            font-style:italic;
            cursor:pointer;
            color:#bbb;
          "
          onclick="location.href='/?q=${encodeURIComponent(q)}'"
        >
          Show all…
        </div>
      `;
    }
    resultsDiv.innerHTML = html;
    resultsDiv.style.display = matches.length ? 'block' : 'none';
  });

  // 7) Auth link handlers
  if (user === null) {
    document.getElementById('loginLink')?.addEventListener('click', (e) => {
      e.preventDefault();
      openModal('loginModal');
    });
    document.getElementById('registerLink')?.addEventListener('click', (e) => {
      e.preventDefault();
      openModal('registerModal');
    });
  } else {
    document.getElementById('logoutLink')?.addEventListener('click', async (e) => {
      e.preventDefault();
      await fetch('/api/auth/logout', { method: 'POST' });
      await buildHeader();
    });
  }

  // 8) Modal open/close & form handlers
  document.querySelectorAll('.modal .close').forEach((btn) => {
    btn.onclick = () => closeModal(btn.dataset.target);
  });
  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
      closeModal(e.target.id);
    }
  });
  document.getElementById('toRegister')?.addEventListener('click', (e) => {
    e.preventDefault();
    closeModal('loginModal');
    openModal('registerModal');
  });
  document.getElementById('toLogin')?.addEventListener('click', (e) => {
    e.preventDefault();
    closeModal('registerModal');
    openModal('loginModal');
  });

  // 9) Login & register forms rebuild header on success
  document.getElementById('loginForm').onsubmit = async (e) => {
    e.preventDefault();
    const u = document.getElementById('loginUsername').value.trim();
    const p = document.getElementById('loginPassword').value;
    const msg = document.getElementById('loginMsg');
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p }),
    });
    const data = await res.json();
    msg.innerText = data.message;
    if (res.ok) {
      closeModal('loginModal');
      await buildHeader();
    }
  };
  document.getElementById('registerForm').onsubmit = async (e) => {
    e.preventDefault();
    const u = document.getElementById('regUsername').value.trim();
    const em = document.getElementById('regEmail').value.trim();
    const p = document.getElementById('regPassword').value;
    const c = document.getElementById('regConfirm').value;
    const msg = document.getElementById('regMsg');
    if (p !== c) {
      msg.innerText = 'Passwords must match';
      return;
    }
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, email: em, password: p }),
    });
    const data = await res.json();
    msg.innerText = data.message;
  };

  // 10) Finally, dispatch an initial “filterChanged” so that any page code listening
  // can pick up the default values from the dropdown and switch.
  window.dispatchEvent(
    new CustomEvent('filterChanged', {
      detail: {
        genre: getSelectedGenre(),
        rlOnly: getRlOnlyFlag(),
      },
    })
  );
}

//
// ──────────────────────────────────────────────────────────────────────────────
// Helper: Insert “Filter by Genre” dropdown + Apply button into the <header>
// ──────────────────────────────────────────────────────────────────────────────
function insertGenreFilterIntoHeader() {
  const placeholder = document.getElementById('genreFilterPlaceholder');
  if (!placeholder) return;

  // Container for dropdown + button
  const container = document.createElement('div');
  container.id = 'genreFilterContainer';
  container.style.display = 'inline-flex';
  container.style.alignItems = 'center';
  container.style.marginLeft = '1rem';

  // <select> element for genres
  const dropdown = document.createElement('select');
  dropdown.id = 'genreFilterDropdown';
  dropdown.style.background = '#1e1e1e';
  dropdown.style.color = '#fff';
  dropdown.style.border = '1px solid #444';
  dropdown.style.borderRadius = '4px';
  dropdown.style.padding = '4px 8px';
  dropdown.style.fontSize = '0.9rem';
  dropdown.style.cursor = 'pointer';
  dropdown.style.minWidth = '120px';

  // First option is always “All Genres”
  const allOpt = document.createElement('option');
  allOpt.value = '';
  allOpt.textContent = 'All Genres';
  dropdown.appendChild(allOpt);

  // “Apply” button to trigger filtering
  const applyBtn = document.createElement('button');
  applyBtn.id = 'applyGenreFilter';
  applyBtn.textContent = 'Apply';
  applyBtn.style.background = '#e53935';
  applyBtn.style.color = '#fff';
  applyBtn.style.border = 'none';
  applyBtn.style.borderRadius = '4px';
  applyBtn.style.padding = '5px 10px';
  applyBtn.style.fontSize = '0.9rem';
  applyBtn.style.marginLeft = '0.5rem';
  applyBtn.style.cursor = 'pointer';
  applyBtn.style.transition = 'background 0.2s ease';
  applyBtn.onmouseover = () => (applyBtn.style.background = '#b71c1c');
  applyBtn.onmouseout = () => (applyBtn.style.background = '#e53935');

  // Append dropdown + button into their container
  container.appendChild(dropdown);
  container.appendChild(applyBtn);
  placeholder.replaceWith(container);

  // Fetch genres from /api/genres (public endpoint) and populate dropdown.
  fetch('/api/genres')
    .then((res) => {
      if (!res.ok) throw new Error('Failed to load genres');
      return res.json();
    })
    .then((data) => {
      // Handle either:
      //   • data = { genres: [ "Action", "Comedy", ... ] }
      //   • data = [ "Action", "Comedy", ... ]
      let genresArray = [];
      if (Array.isArray(data)) {
        genresArray = data;
      } else if (Array.isArray(data.genres)) {
        genresArray = data.genres;
      }
      genresArray.forEach((g) => {
        const opt = document.createElement('option');
        opt.value = g;
        opt.textContent = g;
        dropdown.appendChild(opt);
      });

      // If a ?genre=XYZ parameter exists in the URL, preselect it
      const params = new URLSearchParams(window.location.search);
      const requested = params.get('genre') || '';
      if (
        requested &&
        dropdown.querySelector(`option[value="${requested}"]`)
      ) {
        dropdown.value = requested;
      }
    })
    .catch(() => {
      // If the fetch fails, we silently continue with only “All Genres”
    });

  // When “Apply” is clicked, dispatch a ‘filterChanged’ event with the chosen genre.
  applyBtn.addEventListener('click', () => {
    const selectedGenre = dropdown.value;
    const rlOnly = getRlOnlyFlag();
    window.dispatchEvent(
      new CustomEvent('filterChanged', {
        detail: {
          genre: selectedGenre,
          rlOnly: rlOnly,
        },
      })
    );
  });
}

//
// ──────────────────────────────────────────────────────────────────────────────
// Helper: Insert “Anime?” switch into the <header>
// ──────────────────────────────────────────────────────────────────────────────
function insertRlSwitchIntoHeader() {
  const placeholder = document.getElementById('rlSwitchPlaceholder');
  if (!placeholder) return;

  // Container for label + switch
  const container = document.createElement('div');
  container.id = 'rlSwitchContainer';
  container.style.display = 'inline-flex';
  container.style.alignItems = 'center';
  container.style.marginLeft = '1rem';

  // Label “Anime?”
  const label = document.createElement('span');
  label.textContent = 'Anime?';
  label.style.marginRight = '0.5rem';
  label.style.fontSize = '0.9rem';
  label.style.color = '#fff';

  // Switch wrapper (“No” ⎯ toggle ⎯ “Yes”)
  const switchWrapper = document.createElement('div');
  switchWrapper.style.display = 'flex';
  switchWrapper.style.alignItems = 'center';

  const noLabel = document.createElement('span');
  noLabel.textContent = 'No';
  noLabel.style.color = '#bbb';
  noLabel.style.marginRight = '4px';
  noLabel.style.fontSize = '0.8rem';

  // Hidden checkbox + track + knob
  const toggleLabel = document.createElement('label');
  toggleLabel.style.position = 'relative';
  toggleLabel.style.display = 'inline-block';
  toggleLabel.style.width = '40px';
  toggleLabel.style.height = '20px';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.id = 'rlToggle';
  checkbox.style.opacity = '0';
  checkbox.style.width = '0';
  checkbox.style.height = '0';

  const slider = document.createElement('span');
  slider.style.position = 'absolute';
  slider.style.cursor = 'pointer';
  slider.style.top = '0';
  slider.style.left = '0';
  slider.style.right = '0';
  slider.style.bottom = '0';
  slider.style.backgroundColor = '#ccc';
  slider.style.transition = '.4s';
  slider.style.borderRadius = '20px';

  const knob = document.createElement('span');
  knob.style.position = 'absolute';
  knob.style.height = '16px';
  knob.style.width = '16px';
  knob.style.left = '2px';
  knob.style.bottom = '2px';
  knob.style.backgroundColor = 'white';
  knob.style.transition = '.4s';
  knob.style.borderRadius = '50%';

  slider.appendChild(knob);
  toggleLabel.appendChild(checkbox);
  toggleLabel.appendChild(slider);

  const yesLabel = document.createElement('span');
  yesLabel.textContent = 'Yes';
  yesLabel.style.color = '#bbb';
  yesLabel.style.marginLeft = '4px';
  yesLabel.style.fontSize = '0.8rem';

  switchWrapper.appendChild(noLabel);
  switchWrapper.appendChild(toggleLabel);
  switchWrapper.appendChild(yesLabel);

  container.appendChild(label);
  container.appendChild(switchWrapper);
  placeholder.replaceWith(container);

  // When the checkbox changes, update localStorage and dispatch “filterChanged”
  checkbox.addEventListener('change', () => {
    if (checkbox.checked) {
      slider.style.backgroundColor = '#4CAF50';
      knob.style.transform = 'translateX(20px)';
      localStorage.setItem('rlOnly', 'false');
    } else {
      slider.style.backgroundColor = '#ccc';
      knob.style.transform = 'translateX(0)';
      localStorage.setItem('rlOnly', 'true');
    }
    window.dispatchEvent(
      new CustomEvent('filterChanged', {
        detail: {
          genre: getSelectedGenre(),
          rlOnly: getRlOnlyFlag(),
        },
      })
    );
  });

  // Initialize from localStorage (default to “true”)
  const saved = localStorage.getItem('rlOnly');
  if (saved === 'false') {
    checkbox.checked = true;
    slider.style.backgroundColor = '#4CAF50';
    knob.style.transform = 'translateX(20px)';
  } else {
    checkbox.checked = false;
    slider.style.backgroundColor = '#ccc';
    knob.style.transform = 'translateX(0)';
    localStorage.setItem('rlOnly', 'true');
  }
}

//
// ──────────────────────────────────────────────────────────────────────────────
// Helpers to read current filter state
// ──────────────────────────────────────────────────────────────────────────────
function getSelectedGenre() {
  const dropdown = document.getElementById('genreFilterDropdown');
  return dropdown ? dropdown.value : '';
}
function getRlOnlyFlag() {
  // "true" → filter to *RL only, "false" → show all
  return localStorage.getItem('rlOnly') === 'true';
}

//
// ──────────────────────────────────────────────────────────────────────────────
// Helper: open/close a modal by ID
// ──────────────────────────────────────────────────────────────────────────────
function openModal(id) {
  document.getElementById(id)?.classList.add('active');
}
function closeModal(id) {
  document.getElementById(id)?.classList.remove('active');
}

// 9) Build the homepage hero (no default/fallback)
async function buildHero() {
  try {
    const res = await fetch('/api/anime/featured');
    if (!res.ok) {
      if (res.status === 404) return;
      return;
    }
    const show = await res.json();

    const heroSection = document.getElementById('heroSection');
    heroSection.style.backgroundImage = `url('${show.image_url}')`;

    document.getElementById('heroTitle').textContent = show.title;
    document.getElementById('heroDescription').textContent =
      show.description || '';
    document.getElementById('heroDescription').onclick = () => {
      location.href = `/show.html?showId=${encodeURIComponent(show.id)}`;
    };

    const btn = document.getElementById('heroButton');
    if (btn) btn.href = `/show.html?showId=${encodeURIComponent(show.id)}`;
  } catch {
    // silently ignore buildHero errors
  }
}

// 10) Kick everything off
document.addEventListener('DOMContentLoaded', () => {
  buildHeader();
  buildHero();
});
window.buildHeader = buildHeader;
window.buildHero = buildHero;
