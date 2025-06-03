// public/adminFeatured.js

document.addEventListener('DOMContentLoaded', initFeatured);

async function initFeatured() {
  const container = document.getElementById('featuredCheckboxes');
  const saveBtn   = document.getElementById('saveFeatured');
  const msg       = document.getElementById('featuredMsg');

  // ─── 1) Load currently saved “featured” IDs ─────────────────────────────────
  let featuredIds = [];
  try {
    const res = await fetch('/api/admin/featured');
    if (!res.ok) throw new Error(`GET /api/admin/featured returned status ${res.status}`);
    const raw = await res.json();

    // Determine which key holds the array of IDs:
    if (Array.isArray(raw)) {
      // e.g. server returned [7,5]
      featuredIds = raw;
    } else if (Array.isArray(raw.animeIds)) {
      // e.g. server returned { animeIds: [7,5] }
      featuredIds = raw.animeIds;
    } else if (Array.isArray(raw.featured)) {
      // e.g. server returned { featured: [7,5] }
      featuredIds = raw.featured;
    } else if (Array.isArray(raw.ids)) {
      // e.g. server returned { ids: [7,5] }
      featuredIds = raw.ids;
    } else {
      console.warn('Unexpected shape from /api/admin/featured. Using empty array.', raw);
      featuredIds = [];
    }
  } catch (err) {
    console.warn('Could not fetch /api/admin/featured:', err);
    // Even if this fails, we’ll continue and render all checkboxes unchecked.
    featuredIds = [];
  }

  // ─── 2) Load ALL anime/shows from the admin endpoint ─────────────────────────
  let shows = [];
  try {
    const res = await fetch('/api/admin/anime');
    if (!res.ok) throw new Error(`GET /api/admin/anime returned status ${res.status}`);
    shows = await res.json();
  } catch (err) {
    msg.textContent = '❌ Failed to load anime list';
    msg.style.color = '#e53935';
    console.error('Error fetching /api/admin/anime:', err);
    return;
  }

  // ─── 3) Render checkboxes, marking those in featuredIds as checked ────────────
  container.innerHTML = shows.map(s => {
    const isChecked = featuredIds.includes(s.id) ? 'checked' : '';
    return `
      <label style="display:block; margin-bottom:6px;">
        <input type="checkbox" value="${s.id}" ${isChecked}>
        ${s.title}
      </label>
    `;
  }).join('');

  // ─── 4) When “Save Featured” is clicked, collect the checked IDs and POST ────
  saveBtn.addEventListener('click', async () => {
    // Gather all checked IDs
    const selected = Array.from(
      container.querySelectorAll('input[type="checkbox"]:checked')
    ).map(cb => parseInt(cb.value, 10));

    // Clear any previous message
    msg.textContent = '';
    msg.style.color = '';

    try {
      const res  = await fetch('/api/admin/featured', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ animeIds: selected })
      });
      const data = await res.json();

      if (!res.ok) {
        // Display server‐side error if provided
        const errorMsg = data.error || data.message || 'Unknown error';
        throw new Error(errorMsg);
      }

      msg.textContent = '✅ Featured list updated!';
      msg.style.color = '#4caf50';

      // Update our local featuredIds and re‐render checkboxes so they remain in sync
      // (server might return the saved array under different key names)
      if (Array.isArray(data.animeIds)) {
        featuredIds = data.animeIds;
      } else if (Array.isArray(data.featured)) {
        featuredIds = data.featured;
      } else if (Array.isArray(data.ids)) {
        featuredIds = data.ids;
      } else {
        // Fallback to what we just submitted
        featuredIds = selected;
      }

      // Re‐render, marking only those in updated featuredIds
      container.innerHTML = shows.map(s => {
        const isChecked = featuredIds.includes(s.id) ? 'checked' : '';
        return `
          <label style="display:block; margin-bottom:6px;">
            <input type="checkbox" value="${s.id}" ${isChecked}>
            ${s.title}
          </label>
        `;
      }).join('');

    } catch (err) {
      msg.textContent = `❌ ${err.message}`;
      msg.style.color = '#e53935';
      console.error('Error saving featured list:', err);
    }
  });
}






  