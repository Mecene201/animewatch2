// public/hero.js

document.addEventListener('DOMContentLoaded', async () => {
  // 1) grab the slider container + controls + text placeholders
  const slider    = document.querySelector('.hero-slider');
  const titleEl   = document.getElementById('heroTitle');
  const descEl    = document.getElementById('heroDescription');
  const btnEl     = document.getElementById('heroButton');
  const prevBtn   = document.getElementById('heroPrev');
  const nextBtn   = document.getElementById('heroNext');

  // 2) fetch your featured endpoint
  let slides = [];
  try {
    const res = await fetch('/api/anime/featured');
    if (!res.ok) throw new Error(`Status ${res.status}`);
    slides = await res.json();
  } catch (err) {
    console.error('Failed to load featured:', err);
    return;
  }

  if (!slides.length) return;

  // 3) render empty slides into the DOM
  slider.innerHTML = slides.map(s => `
    <div class="hero-slide" style="background-image:url('${s.image_url}')"></div>
  `).join('');

  const elems = Array.from(slider.children);
  let idx = 0;
  let isMoving = false;

  // 4) hide all but the first
  elems.forEach((el, i) => el.style.display = i === 0 ? 'flex' : 'none');

  // 5) helper to update the text/button underlay
  function updateFrame(i) {
    const s = slides[i];
    titleEl.textContent = s.title;
    descEl.textContent  = s.description || '';
    btnEl.href = `/show.html?showId=${s.id}`;
  }

  updateFrame(0);

  // 6) rotation logic
  let interval = setInterval(() => goTo(idx + 1), 3000);

  function goTo(newIdx) {
    if (isMoving) return;
    isMoving = true;
    elems[idx].style.display = 'none';
    idx = (newIdx + elems.length) % elems.length;
    elems[idx].style.display = 'flex';
    updateFrame(idx);
    // small delay before allowing the next change
    setTimeout(() => isMoving = false, 50);
  }

  // 7) wire up prev/next buttons
  prevBtn.onclick = () => {
    clearInterval(interval);
    goTo(idx - 1);
    interval = setInterval(() => goTo(idx + 1), 3000);
  };
  nextBtn.onclick = () => {
    clearInterval(interval);
    goTo(idx + 1);
    interval = setInterval(() => goTo(idx + 1), 3000);
  };
});
