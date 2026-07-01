import { state } from './state.js';
import { hourChronoOrder } from './grid.js';

let storySlides       = [];
let storyCurrentIndex = 0;
let storyInterval     = null;
let storyPaused       = false;
let storyUsedPhotos   = new Set();

// ── Init ───────────────────────────────────────────────────

export function initStory() {
  const overlay  = document.getElementById('story-overlay');
  const closeBtn = document.getElementById('story-close');
  const zonePrev = document.getElementById('story-zone-prev');
  const zoneNext = document.getElementById('story-zone-next');
  if (!overlay) return;

  zonePrev?.addEventListener('click', e => { e.stopPropagation(); storyPrev(); });
  zoneNext?.addEventListener('click', e => { e.stopPropagation(); storyNext(); });
  closeBtn?.addEventListener('click', e => { e.stopPropagation(); closeStory(); });

  // Appui long = pause
  let pressTimer = null, isLong = false;
  const touchZones = document.querySelector('.story-touch-zones');
  if (touchZones) {
    const startPress = e => {
      if (e.target.closest('.story-close-btn')) return;
      isLong = false;
      pressTimer = setTimeout(() => {
        isLong = true; storyPaused = true;
        clearTimeout(storyInterval);
        document.querySelector('.story-progress-bar.active')?.style && (document.querySelector('.story-progress-bar.active').style.animationPlayState = 'paused');
        document.getElementById('story-pause-indicator')?.classList.add('visible');
      }, 400);
    };
    const endPress = () => {
      clearTimeout(pressTimer);
      if (isLong && storyPaused) {
        storyPaused = false;
        document.getElementById('story-pause-indicator')?.classList.remove('visible');
        storyUpdateProgressBars();
        storyStartAutoAdvance();
      }
    };
    touchZones.addEventListener('mousedown', startPress);
    touchZones.addEventListener('mouseup',   endPress);
    touchZones.addEventListener('mouseleave',endPress);
    touchZones.addEventListener('touchstart',startPress, { passive: true });
    touchZones.addEventListener('touchend',  endPress);
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) closeStory();
  });
}

// ── API publique ───────────────────────────────────────────

export function openGlobalStory() {
  storyBuildSlides('all');
  preloadStoryImagesExact();
  const overlay = document.getElementById('story-overlay');
  if (!overlay) return;
  document.body.classList.add('story-open');
  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  startStory(0, 'all');
}

export function openFilteredStory(hour) {
  // Délègue au mode film strip
  window.openFilmStrip?.(hour);
}

// ── Logique story ──────────────────────────────────────────

function startStory(startIndex = 0) {
  storyCurrentIndex = startIndex;
  storyRenderProgressBars();
  storyShowSlide(startIndex);
}

function storyBuildSlides(targetHour = 'all') {
  storySlides = [];
  storyUsedPhotos.clear();
  const { photos } = state;

  if (targetHour !== 'all') {
    let hourPhotos = photos.filter(p => p.hour === targetHour)
      .sort((a, b) => (a.sortIndex ?? a.id) - (b.sortIndex ?? b.id))
      .slice(0, 20);
    storySlides.push({ type: 'transition', hour: targetHour, subtitle: `${hourPhotos.length} photo${hourPhotos.length > 1 ? 's' : ''} sélectionnées` });
    let remaining = [...hourPhotos];
    while (remaining.length > 0) {
      const isLast = remaining.length <= 4;
      const count  = isLast ? remaining.length : Math.min(4, Math.max(2, remaining.length));
      const sel    = remaining.splice(0, count);
      sel.forEach(p => storyUsedPhotos.add(p.id));
      storySlides.push({ hour: targetHour, photos: sel, type: 'grid' });
    }
    return;
  }

  const hourGroups = {};
  photos.forEach(p => {
    const h = p.hour || '00:00';
    if (!hourGroups[h]) hourGroups[h] = [];
    hourGroups[h].push(p);
  });
  storySlides.push({ type: 'transition', hour: 'REWIND', subtitle: 'La story de votre soirée' });

  Object.entries(hourGroups)
    .sort(([a], [b]) => hourChronoOrder(a) - hourChronoOrder(b))
    .forEach(([hour, hourPhotos]) => {
      const ordered = [...hourPhotos].sort((a, b) => (a.sortIndex ?? a.id) - (b.sortIndex ?? b.id));
      for (let i = 0; i < 2 && ordered.length >= 2; i++) {
        const count = Math.min(4, Math.max(2, Math.floor(Math.random() * 3) + 2), ordered.length);
        if (i === 0) storySlides.push({ hour, type: 'transition' });
        const sel = ordered.splice(0, count);
        sel.forEach(p => storyUsedPhotos.add(p.id));
        storySlides.push({ hour, photos: sel, type: 'grid' });
      }
    });

  storySlides.push({ type: 'outro', hour: 'FIN.', subtitle: "Place à l'album complet… ✨" });
}

function preloadStoryImagesExact() {
  const usedPhotos = state.photos.filter(p => storyUsedPhotos.has(p.id));
  let i = 0;
  const preloadBatch = () => {
    const batch = usedPhotos.slice(i, i + 5);
    if (!batch.length) return;
    batch.forEach(p => { if (p.src) { const img = new Image(); img.src = p.src; } });
    i += 5;
    setTimeout(preloadBatch, 50);
  };
  preloadBatch();
}

function storyRenderProgressBars() {
  const container = document.getElementById('story-progress');
  if (!container) return;
  container.innerHTML = storySlides.map((_, i) =>
    `<div class="story-progress-bar ${i === 0 ? 'active' : ''}" data-index="${i}">
      <div class="story-progress-fill"></div>
    </div>`
  ).join('');
}

function storyShowSlide(index) {
  if (index < 0 || index >= storySlides.length) { closeStory(); return; }
  storyCurrentIndex = index;
  const slide    = storySlides[index];
  const slideEl  = document.getElementById('story-slide');
  const timeEl   = document.getElementById('story-time');
  if (!slideEl) return;
  if (timeEl) timeEl.textContent = slide.hour;

  // Précharge les 3 suivantes
  for (let i = 1; i <= 3; i++) {
    const s = storySlides[index + i];
    if (s?.photos) s.photos.forEach(p => { if (p.src) { const img = new Image(); img.src = p.src; } });
  }

  if (slide.type === 'transition' || slide.type === 'outro') {
    slideEl.innerHTML = `<div class="story-slide-transition">
      <span class="story-transition-hour">${slide.hour}</span>
      ${slide.subtitle ? `<span class="story-transition-subtitle">${slide.subtitle}</span>` : ''}
    </div>`;
  } else if (slide.type === 'grid') {
    const count = slide.photos.length;
    const first = slide.photos[0].src;
    let layoutClass, layoutHtml;
    if (count === 2) {
      layoutClass = 'story-column-layout';
      layoutHtml  = slide.photos.map(p => `<div class="story-grid-item"><img src="${p.src}" loading="eager"></div>`).join('');
    } else {
      layoutClass = `story-grid ${count === 3 ? 'grid-3' : 'grid-4'}`;
      layoutHtml  = slide.photos.map(p => `<div class="story-grid-item"><img src="${p.src}" loading="eager"></div>`).join('');
    }
    slideEl.innerHTML = `<div class="story-bg-blur"><img src="${first}" loading="eager"></div>
      <div class="${layoutClass}">${layoutHtml}</div>`;
  }

  storyUpdateProgressBars();
  storyStartAutoAdvance();
}

function storyUpdateProgressBars() {
  const slide     = storySlides[storyCurrentIndex];
  const isShort   = slide?.type === 'transition' || slide?.type === 'outro';
  const duration  = isShort ? 2000 : 5000;
  document.querySelectorAll('.story-progress-bar').forEach((bar, i) => {
    bar.classList.remove('active', 'completed');
    if (i < storyCurrentIndex) bar.classList.add('completed');
    else if (i === storyCurrentIndex) { bar.style.setProperty('--story-duration', `${duration}ms`); bar.classList.add('active'); }
  });
}

function storyStartAutoAdvance() {
  clearTimeout(storyInterval);
  if (storyPaused) return;
  const slide    = storySlides[storyCurrentIndex];
  const isShort  = slide?.type === 'transition' || slide?.type === 'outro';
  storyInterval  = setTimeout(() => { if (!storyPaused) storyNext(); }, isShort ? 2000 : 5000);
}

function storyNext() {
  if (storySlides[storyCurrentIndex]?.type === 'outro') { closeStory(); return; }
  storyShowSlide(storyCurrentIndex + 1);
}

function storyPrev() {
  storyShowSlide(storyCurrentIndex - 1);
}

export function closeStory() {
  document.getElementById('story-overlay')?.classList.add('hidden');
  document.body.style.overflow = '';
  document.body.classList.remove('story-open');
  clearTimeout(storyInterval);
  storyPaused = false;
  storyCurrentIndex = 0;
}
