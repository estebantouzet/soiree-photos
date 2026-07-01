import { state } from './state.js';

let filmPhotos        = [];
let filmCurrentIndex  = 0;
let filmObserver      = null;

// ── Ouverture ──────────────────────────────────────────────

export function openFilmStrip(hour) {
  filmPhotos = state.photos
    .filter(p => p.hour === hour)
    .sort((a, b) => (a.sortIndex ?? a.id) - (b.sortIndex ?? b.id));
  if (!filmPhotos.length) return;

  const overlay   = document.getElementById('film-strip-overlay');
  const scrollEl  = document.getElementById('film-strip-scroll');
  const hourLabel = document.getElementById('film-strip-hour');
  const totalEl   = document.getElementById('film-total');
  const indicator = document.getElementById('film-strip-indicator');
  if (!overlay || !scrollEl) return;

  if (hourLabel) hourLabel.textContent = hour;
  if (totalEl)   totalEl.textContent   = filmPhotos.length;

  const perfs = Array.from({ length: 4 }, (_, i) =>
    `<div class="film-perf" style="animation-delay:${i * 0.05}s"></div>`).join('');

  scrollEl.innerHTML = filmPhotos.map((p, i) => `
    <div class="film-frame ${i === 0 ? 'active' : ''}" data-index="${i}">
      <div class="film-frame-body loading">
        <div class="film-perfs top">${perfs}</div>
        <img class="film-frame-img thumb-loading"
          src="${p.thumb || p.src}" alt="${p.time || ''}"
          loading="${i < 3 ? 'eager' : 'lazy'}"
          data-index="${i}" data-fullsrc="${p.src}"
          onload="onFilmImageLoad(this)"/>
        <div class="film-perfs bottom">${perfs}</div>
        <span class="film-frame-number">${String(i + 1).padStart(2, '0')}</span>
      </div>
    </div>`).join('');

  if (indicator) {
    indicator.innerHTML = filmPhotos.map((_, i) =>
      `<div class="film-indicator-dot ${i === 0 ? 'active' : ''}" data-index="${i}"></div>`
    ).join('');
  }

  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  document.body.classList.add('film-strip-open');

  filmCurrentIndex = 0;
  updateFilmCounter();
  initFilmObserver(scrollEl);
  initFilmDrag(scrollEl);
  preloadFilmImages(3);
}

// ── Fermeture ──────────────────────────────────────────────

export function closeFilmStrip() {
  document.getElementById('film-strip-overlay')?.classList.add('hidden');
  document.body.style.overflow = '';
  document.body.classList.remove('film-strip-open');
  if (filmObserver) { filmObserver.disconnect(); filmObserver = null; }
  filmPhotos = [];
  filmCurrentIndex = 0;
}

// ── Navigation ─────────────────────────────────────────────

export function filmStripPrev() { goToFrame(filmCurrentIndex - 1); }
export function filmStripNext() { goToFrame(filmCurrentIndex + 1); }

function goToFrame(index) {
  if (index < 0 || index >= filmPhotos.length) return;
  const scrollEl = document.getElementById('film-strip-scroll');
  const frames   = scrollEl?.querySelectorAll('.film-frame');
  frames?.[index]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
}

// ── Chargement images ──────────────────────────────────────

export function onFilmImageLoad(img) {
  if (!img.naturalWidth || !img.naturalHeight) return;
  const ratio = img.naturalWidth / img.naturalHeight;
  img.classList.remove('landscape','square','ultra-landscape','ultra-portrait');
  if (ratio > 2)                        img.classList.add('ultra-landscape');
  else if (ratio > 1.15)                img.classList.add('landscape');
  else if (ratio >= 0.85 && ratio <= 1.15) img.classList.add('square');
  else if (ratio < 0.5)                 img.classList.add('ultra-portrait');
  loadFullRes(img);
}

function loadFullRes(img) {
  const fullSrc = img.dataset.fullsrc;
  if (!fullSrc || img.src.includes(fullSrc)) return;
  const full = new Image();
  full.onload = () => {
    img.src = fullSrc;
    img.classList.remove('thumb-loading');
    img.classList.add('full-res-loaded');
    const body = img.closest('.film-frame-body');
    if (body) { body.classList.remove('loading'); body.classList.add('loaded'); }
  };
  full.onerror = () => { img.classList.remove('thumb-loading'); };
  full.src = fullSrc;
}

function preloadFilmImages(count) {
  for (let i = 0; i < Math.min(count, filmPhotos.length); i++) {
    const p = filmPhotos[i];
    if (p.src) { const img = new Image(); img.src = p.src; }
  }
}

function preloadFilmStripFullRes() {
  const scrollEl = document.getElementById('film-strip-scroll');
  if (!scrollEl) return;
  const frames = scrollEl.querySelectorAll('.film-frame');
  const center = scrollEl.scrollLeft + scrollEl.clientWidth / 2;
  let nearest = 0, nearDist = Infinity;
  frames.forEach(f => {
    const d = Math.abs(f.offsetLeft + f.offsetWidth / 2 - center);
    if (d < nearDist) { nearDist = d; nearest = +f.dataset.index; }
  });
  for (let i = -2; i <= 2; i++) {
    const idx = nearest + i;
    if (idx >= 0 && idx < filmPhotos.length) {
      const img = frames[idx]?.querySelector('.film-frame-img');
      if (img) loadFullRes(img);
    }
  }
}

// ── Helpers UI ─────────────────────────────────────────────

function updateFilmCounter() {
  const el = document.getElementById('film-current');
  if (el) el.textContent = filmCurrentIndex + 1;
}

function updateFilmIndicator() {
  document.querySelectorAll('.film-indicator-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === filmCurrentIndex);
  });
}

// ── IntersectionObserver ───────────────────────────────────

function initFilmObserver(scrollEl) {
  if (filmObserver) filmObserver.disconnect();
  filmObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const idx = +entry.target.dataset.index;
      if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
        entry.target.classList.add('active');
        filmCurrentIndex = idx;
        updateFilmCounter();
        updateFilmIndicator();
        preloadFilmStripFullRes();
      } else {
        entry.target.classList.remove('active');
      }
    });
  }, { root: scrollEl, threshold: [0.5, 0.75, 1.0], rootMargin: '0px -20% 0px -20%' });

  scrollEl.querySelectorAll('.film-frame').forEach(f => filmObserver.observe(f));
  setTimeout(() => preloadFilmStripFullRes(), 300);
}

// ── Drag / swipe ───────────────────────────────────────────

function initFilmDrag(scrollEl) {
  let isDown = false, startX = 0, scrollLeft = 0, velocity = 0, lastX = 0, lastTime = 0, rafId = null;

  const applyMomentum = () => {
    if (Math.abs(velocity) < 0.5) { snapNearest(scrollEl); return; }
    scrollEl.scrollLeft += velocity;
    velocity *= 0.9;
    rafId = requestAnimationFrame(applyMomentum);
  };

  scrollEl.addEventListener('mousedown', e => {
    isDown = true; startX = e.pageX - scrollEl.offsetLeft; scrollLeft = scrollEl.scrollLeft;
    lastX = e.pageX; lastTime = Date.now(); velocity = 0;
    if (rafId) cancelAnimationFrame(rafId);
  });
  scrollEl.addEventListener('mouseleave', () => { if (isDown) { isDown = false; applyMomentum(); } });
  scrollEl.addEventListener('mouseup',    () => { isDown = false; applyMomentum(); });
  scrollEl.addEventListener('mousemove', e => {
    if (!isDown) return;
    e.preventDefault();
    const x  = e.pageX - scrollEl.offsetLeft;
    const dx = (x - startX);
    scrollEl.scrollLeft = scrollLeft - dx;
    const now = Date.now();
    velocity = (e.pageX - lastX) / (now - lastTime || 1) * 16;
    lastX = e.pageX; lastTime = now;
  });

  // Touch
  let touchStartX = 0;
  scrollEl.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
    if (rafId) cancelAnimationFrame(rafId);
    velocity = 0;
  }, { passive: true });
  scrollEl.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    velocity = -dx * 0.3;
    applyMomentum();
  }, { passive: true });
}

function snapNearest(scrollEl) {
  const frames = scrollEl.querySelectorAll('.film-frame');
  const center = scrollEl.scrollLeft + scrollEl.clientWidth / 2;
  let nearest = null, nearDist = Infinity;
  frames.forEach(f => {
    const d = Math.abs(f.offsetLeft + f.offsetWidth / 2 - center);
    if (d < nearDist) { nearDist = d; nearest = f; }
  });
  nearest?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
}

// ── Init boutons ───────────────────────────────────────────

export function initFilmStrip() {
  document.getElementById('film-strip-close')?.addEventListener('click', closeFilmStrip);
  document.getElementById('film-nav-prev')?.addEventListener('click', filmStripPrev);
  document.getElementById('film-nav-next')?.addEventListener('click', filmStripNext);
  document.addEventListener('keydown', e => {
    const overlay = document.getElementById('film-strip-overlay');
    if (overlay?.classList.contains('hidden')) return;
    if (e.key === 'Escape')      closeFilmStrip();
    if (e.key === 'ArrowLeft')  { e.preventDefault(); filmStripPrev(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); filmStripNext(); }
  });
}
