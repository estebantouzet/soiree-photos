import { state } from './state.js';

export const haptic = (p = 10) => { if (navigator.vibrate) navigator.vibrate(p); };

export function escapeHtml(text) {
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}

export function formatPhotoMeta(photo) {
  const cfg = state.eventConfig;
  const eventDate = cfg.date || '';
  let dateLabel = '';
  if (photo.date && photo.date !== eventDate) {
    try {
      dateLabel = new Date(photo.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
    } catch { dateLabel = photo.date; }
  }
  return { date: dateLabel, time: photo.time || '' };
}

export function preloadImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

export function preloadAdjacentImages() {
  const { photos, lightboxIdx } = state;
  if (lightboxIdx === null || !photos.length) return;
  const idx = photos.findIndex(p => p.id === lightboxIdx);
  [-1, 1].forEach(offset => {
    const adj = photos[(idx + offset + photos.length) % photos.length];
    if (adj) { const img = new Image(); img.src = adj.src; }
  });
}

export function getUserFingerprint() {
  let fp = localStorage.getItem('userFP');
  if (!fp) {
    fp = Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('userFP', fp);
  }
  return fp;
}

export function showToast(msg, duration = 2500) {
  let t = document.getElementById('toast-msg');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast-msg';
    t.style.cssText = `position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
      background:rgba(0,0,0,0.85);color:#fff;padding:10px 20px;border-radius:100px;
      font-family:var(--font);font-size:13px;z-index:99999;pointer-events:none;
      opacity:0;transition:opacity 0.3s ease;white-space:nowrap;`;
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(t._to);
  t._to = setTimeout(() => { t.style.opacity = '0'; }, duration);
}

export function debounce(fn, delay) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
}
