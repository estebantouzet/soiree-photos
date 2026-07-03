import { state } from './state.js';
import { haptic, preloadImage, showToast, formatPhotoMeta } from './utils.js';
import { getFiltered, saveFavs, updateFavChip, updateSubtitle, render } from './grid.js';

let slideshowInterval = null;
let slideshowPaused   = false;
let SLIDESHOW_DELAY   = 4000;

// ── Ouverture / fermeture ──────────────────────────────────

export async function openLightbox(id, direction = null) {
  state.lightboxIdx = id;
  const p  = state.photos.find(ph => ph.id === id);
  if (!p) return;

  const lbImg    = document.getElementById('lbImg');
  const lightbox = document.getElementById('lightbox');
  const wrapper  = document.getElementById('lbImgWrapper');

  lbImg.classList.remove('loaded');
  lbImg.alt = p.time || '';

  const meta  = formatPhotoMeta(p);
  const lbDate = document.getElementById('lbDate');
  const lbTime = document.getElementById('lbTime');
  if (lbDate) { lbDate.textContent = meta.date; lbDate.style.display = meta.date ? 'block' : 'none'; }
  if (lbTime) lbTime.textContent = meta.time;

  const lbBg = document.getElementById('lightboxBg');
  if (lbBg) lbBg.style.backgroundImage = `url('${encodeURI(p.thumb || p.src)}')`;

  // Slide transition
  if (direction && wrapper) {
    wrapper.classList.remove('slide-next', 'slide-prev');
    void wrapper.offsetWidth;
    wrapper.classList.add(direction === 'next' ? 'slide-next' : 'slide-prev');
  }

  lightbox.classList.add('open');
  document.body.classList.add('lightbox-open');
  document.body.style.overflow = 'hidden';

  try { await preloadImage(p.src); } catch {}
  lbImg.src = p.src;
  lbImg.classList.add('loaded');

  updateLbFavBtn();

  // Compteur "X / N"
  const list = getFiltered();
  const idx  = list.findIndex(ph => ph.id === id);
  const counter = document.getElementById('lbCounter');
  if (counter) counter.textContent = idx !== -1 ? `${idx + 1} / ${list.length}` : '';

  // Réactions + tags chargés par firebase.js via window hooks
  window.loadReactionsForPhoto?.(id);
  window.loadTagsForPhoto?.(id);

  // Précharge adjacents
  if (idx !== -1) {
    [-1, 1].forEach(off => {
      const adj = list[(idx + off + list.length) % list.length];
      if (adj) { const img = new Image(); img.src = adj.src; }
    });
  }
}

export function closeLightbox() {
  stopSlideshow();
  document.getElementById('lightbox')?.classList.remove('open');
  document.body.classList.remove('lightbox-open');
  document.body.style.overflow = '';
  state.lightboxIdx = null;
  window.tagMode = false;
  window.dismissTagBubble?.();
}

export function handleLightboxClick(e) {
  if (e.target === document.getElementById('lightbox')) closeLightbox();
}

// ── Navigation ─────────────────────────────────────────────

export function prevPhoto() {
  if (state.lightboxIdx === null) return;
  const list = getFiltered();
  if (!list.length) return;
  const idx = list.findIndex(p => p.id === state.lightboxIdx);
  if (idx === -1) return;
  openLightbox(list[(idx - 1 + list.length) % list.length].id, 'prev');
}

export function nextPhoto() {
  if (state.lightboxIdx === null) return;
  const list = getFiltered();
  if (!list.length) return;
  const idx = list.findIndex(p => p.id === state.lightboxIdx);
  if (idx === -1) return;
  openLightbox(list[(idx + 1) % list.length].id, 'next');
}

// ── Favoris lightbox ───────────────────────────────────────

export function updateLbFavBtn() {
  if (state.lightboxIdx === null) return;
  const p   = state.photos.find(ph => ph.id === state.lightboxIdx);
  if (!p) return;
  const btn  = document.getElementById('lbFavBtn');
  const ico  = document.getElementById('lbFavIcon');
  const span = btn?.querySelector('span');
  btn?.classList.toggle('active', p.fav);
  if (ico) { ico.style.fill = p.fav ? '#fff' : 'none'; ico.style.stroke = '#fff'; }
  if (span) span.textContent = p.fav ? 'Favori ✓' : 'Favori';
}

export function toggleLightboxFav() {
  if (state.lightboxIdx === null) return;
  haptic(15);
  const photo = state.photos.find(p => p.id === state.lightboxIdx);
  if (photo) photo.fav = !photo.fav;
  saveFavs();
  updateFavChip();
  updateSubtitle();
  updateLbFavBtn();
  render();
}

// ── Téléchargement single ──────────────────────────────────

export function downloadSingle() {
  if (state.lightboxIdx === null) return;
  const p = state.photos.find(ph => ph.id === state.lightboxIdx);
  if (!p) return;
  const a = document.createElement('a');
  a.href = p.src;
  a.download = `${state.eventSlug || 'soiree'}_${(p.time || 'photo').replace(':', 'h')}.jpg`;
  a.click();
}

// ── Diaporama ──────────────────────────────────────────────

export function launchSlideshow() {
  startSlideshow();
  setTimeout(() => {
    const lb = document.getElementById('lightbox');
    try { lb?.requestFullscreen?.() || lb?.webkitRequestFullscreen?.(); } catch {}
  }, 50);
}

export function startSlideshow() {
  const list = getFiltered();
  if (!list.length) { showToast('Aucune photo à afficher'); return; }
  openLightbox(list[0].id);
  slideshowPaused = false;
  updatePauseButton();
  document.getElementById('slideshowSpeedControls').style.display = 'flex';
  if (slideshowInterval) clearInterval(slideshowInterval);
  slideshowInterval = setInterval(nextSlide, SLIDESHOW_DELAY);
  startKenBurns();
}

export function stopSlideshow() {
  if (slideshowInterval) { clearInterval(slideshowInterval); slideshowInterval = null; }
  slideshowPaused = false;
  document.getElementById('slideshowSpeedControls')?.style && (document.getElementById('slideshowSpeedControls').style.display = 'none');
  updatePauseButton();
  try { document.exitFullscreen?.() || document.webkitExitFullscreen?.(); } catch {}
  stopKenBurns();
}

export function toggleDiaporama() {
  if (!slideshowInterval) {
    startSlideshow();
  } else {
    toggleSlideshowPause();
  }
}

function nextSlide() {
  if (slideshowPaused || state.lightboxIdx === null) return;
  const list = getFiltered();
  if (!list.length) { stopSlideshow(); return; }
  const idx = list.findIndex(p => p.id === state.lightboxIdx);
  openLightbox(list[(idx === -1 ? 0 : (idx + 1)) % list.length].id, 'next');
  startKenBurns();
}

export function toggleSlideshowPause() {
  slideshowPaused = !slideshowPaused;
  updatePauseButton();
}

function updatePauseButton() {
  const icon  = document.getElementById('lbPauseIcon');
  const label = document.getElementById('lbPauseLabel');
  if (!icon || !label) return;
  if (!slideshowInterval && !slideshowPaused) {
    icon.innerHTML    = '<polygon points="5 3 19 12 5 21 5 3"/>';
    label.textContent = 'Diaporama';
  } else if (slideshowPaused) {
    icon.innerHTML    = '<polygon points="5 3 19 12 5 21 5 3"/>';
    label.textContent = 'Lecture';
  } else {
    icon.innerHTML    = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
    label.textContent = 'Pause';
  }
}

export function setSlideshowSpeed(speed) {
  SLIDESHOW_DELAY = speed;
  document.documentElement.style.setProperty('--slide-duration', `${speed}ms`);
  document.querySelectorAll('.speed-btn').forEach(btn => btn.classList.toggle('active', +btn.dataset.speed === speed));
  if (slideshowInterval) { clearInterval(slideshowInterval); slideshowInterval = setInterval(nextSlide, SLIDESHOW_DELAY); }
  if (document.getElementById('lightbox')?.classList.contains('open')) startKenBurns();
}

// ── Ken Burns ──────────────────────────────────────────────

function startKenBurns() {
  const wrapper     = document.getElementById('lbImgWrapper');
  const img         = document.getElementById('lbImg');
  const progressBar = document.getElementById('lbProgressBar');
  const progressFill = document.getElementById('lbProgressFill');
  if (!img) return;
  img.classList.remove('ken-burns');
  if (progressBar) progressBar.classList.remove('active');
  if (progressFill) progressFill.style.width = '0%';
  void img.offsetWidth;
  if (wrapper) wrapper.dataset.zoom = Math.random() > 0.5 ? 'in' : 'out';
  img.classList.add('ken-burns');
  if (progressBar) progressBar.classList.add('active');
}

function stopKenBurns() {
  document.getElementById('lbImg')?.classList.remove('ken-burns');
  document.getElementById('lbProgressBar')?.classList.remove('active');
}

// ── Swipe tactile ──────────────────────────────────────────

export function initLightboxSwipe() {
  const lb  = document.getElementById('lightbox');
  if (!lb) return;

  let startX = 0, startY = 0, startTime = 0;

  lb.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    startTime = Date.now();
  }, { passive: true });

  lb.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    const dt = Date.now() - startTime;
    if (dt > 400) return;
    if (Math.abs(dx) > Math.abs(dy) * 1.5 && Math.abs(dx) > 50) {
      haptic(8);
      dx < 0 ? nextPhoto() : prevPhoto();
    } else if (dy > 80 && Math.abs(dy) > Math.abs(dx) * 1.5) {
      closeLightbox();
    }
  }, { passive: true });
}
