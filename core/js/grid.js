import { state } from './state.js';
import { haptic, showToast, escapeHtml } from './utils.js';

const preloadCache = new Map();
let revealObserver  = null;
let lazyObserver    = null;

// ── Lazy load ──────────────────────────────────────────────

export function observeLazyImages() {
  if (lazyObserver) { lazyObserver.disconnect(); lazyObserver = null; }
  lazyObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const img = e.target;
        if (img.dataset.src) {
          img.onload = () => img.classList.add('loaded');
          img.onerror = () => img.classList.add('loaded');
          img.src = img.dataset.src;
          delete img.dataset.src;
        }
        lazyObserver.unobserve(img);
      }
    });
  }, { rootMargin: '200px 0px' });
  document.querySelectorAll('img.lazy-img[data-src]').forEach(img => lazyObserver.observe(img));
}

export function initScrollReveal() {
  if (revealObserver) { revealObserver.disconnect(); revealObserver = null; }
  revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        setTimeout(() => e.target.classList.add('visible'), Math.random() * 300);
        revealObserver.unobserve(e.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -50px 0px' });
  document.querySelectorAll('.photo-card:not(.visible)').forEach(c => revealObserver.observe(c));
}

// ── Données ────────────────────────────────────────────────

export function getFiltered() {
  const { photos, currentFilter, searchQuery, sortAsc } = state;
  let list = [...photos];
  if (currentFilter === 'fav') list = list.filter(p => p.fav);
  else if (currentFilter !== 'all') list = list.filter(p => p.hour === currentFilter);
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter(p => (p.time || '').includes(q));
  }
  list.sort((a, b) => {
    const ai = a.sortIndex ?? a.id, bi = b.sortIndex ?? b.id;
    return sortAsc ? ai - bi : bi - ai;
  });
  return list;
}

// ── Rendu grille ───────────────────────────────────────────

export function render() {
  if (lazyObserver) { lazyObserver.disconnect(); lazyObserver = null; }
  const { currentFilter, photos } = state;
  const list    = getFiltered();
  const grid    = document.getElementById('photoGrid');
  const counter = document.getElementById('statsCount');
  if (counter) counter.textContent = `${list.length} photo${list.length !== 1 ? 's' : ''}`;

  if (!list.length) {
    grid.innerHTML = `<div class="empty"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/>
      <circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>Aucune photo trouvée</div>`;
    return;
  }

  const showSections = currentFilter === 'all' && !state.searchQuery;
  let lastSection = null, html = '';

  list.forEach(p => {
    const sectionKey = `${p.date || ''}|${p.hour}`;
    if (showSections && sectionKey !== lastSection) {
      html += `<div class="grid-section-header">${escapeHtml(formatSectionLabel(p))}</div>`;
      lastSection = sectionKey;
    }
    html += `
      <div class="photo-card" onclick="openLightbox(${p.id})">
        <img data-src="${escapeHtml(p.thumb || p.src)}" alt="${escapeHtml(p.time || '')}" class="lazy-img"/>
        <div class="photo-overlay"><p class="photo-time">${escapeHtml(p.time || '')}</p></div>
        <button class="fav-btn ${p.fav ? 'active' : ''}" onclick="toggleFav(event,${p.id})"
          aria-label="${p.fav ? 'Retirer des favoris' : 'Ajouter aux favoris'}">
          <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </button>
      </div>`;
  });

  grid.classList.add('grid-updating');
  grid.innerHTML = html;
  requestAnimationFrame(() => grid.classList.remove('grid-updating'));
  observeLazyImages();
  initScrollReveal();
}

// ── Filtres / timeline ─────────────────────────────────────

export function setFilter(f, el) {
  state.currentFilter = f;
  document.querySelectorAll('.filter-chip, .timeline-point').forEach(c => c.classList.remove('active'));
  if (f === 'all' || f === 'fav') {
    el?.classList.add('active');
    const fill = document.getElementById('timelineFill');
    if (fill) fill.style.width = '0%';
  } else {
    const point = document.querySelector(`.timeline-point[data-hour="${f}"]`);
    point?.classList.add('active');
    point?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    // Avance la ligne de remplissage jusqu'au point actif
    const points = [...document.querySelectorAll('.timeline-point')];
    const idx    = points.indexOf(point);
    const fill   = document.getElementById('timelineFill');
    if (fill && points.length > 1) {
      fill.style.width = `${(idx / (points.length - 1)) * 100}%`;
    }
  }
  updateFilterContext();
  haptic(8);
  render();
}

export function toggleSort() {
  state.sortAsc = !state.sortAsc;
  const lbl = document.getElementById('sortLabel');
  if (lbl) lbl.textContent = state.sortAsc ? 'Plus ancien' : 'Plus récent';
  render();
}

export function toggleGrid() {
  const cols = state.gridColumns;
  state.gridColumns = cols === 2 ? 3 : cols === 3 ? 4 : 2;
  applyGrid();
  const labels = { 2: 'grandes photos', 3: 'photos moyennes', 4: 'petites photos' };
  showToast(`Vue : ${labels[state.gridColumns]}`);
}

export function applyGrid() {
  const grid = document.getElementById('photoGrid');
  if (!grid) return;
  grid.classList.remove('grid-2', 'grid-3', 'grid-4');
  grid.classList.add(`grid-${state.gridColumns}`);
  localStorage.setItem('gridColumns', state.gridColumns);
}

// ── Favoris ────────────────────────────────────────────────

function triggerConfetti(x, y) {
  const colors = ['#e05555','#ff6b6b','#ff8e8e','#ffb4b4'];
  for (let i = 0; i < 12; i++) {
    const p = document.createElement('div');
    p.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:6px;height:6px;
      background:${colors[i%4]};border-radius:50%;pointer-events:none;z-index:1000;`;
    document.body.appendChild(p);
    const angle = (Math.PI * 2 * i) / 12;
    const v = 30 + Math.random() * 30;
    p.animate([
      { transform:'translate(0,0) scale(1)', opacity:1 },
      { transform:`translate(${Math.cos(angle)*v}px,${Math.sin(angle)*v}px) scale(0)`, opacity:0 }
    ], { duration: 500 + Math.random()*200, easing:'cubic-bezier(0,.9,.57,1)' }).onfinish = () => p.remove();
  }
}

export function toggleFav(e, id) {
  e.stopPropagation();
  haptic(15);
  const photo = state.photos.find(p => p.id === id);
  if (!photo) return;
  const wasFav = photo.fav;
  photo.fav = !photo.fav;
  if (!wasFav) {
    const rect = e.currentTarget.getBoundingClientRect();
    triggerConfetti(rect.left + rect.width/2, rect.top + rect.height/2);
    e.currentTarget.classList.add('fav-pulse');
    setTimeout(() => e.currentTarget.classList.remove('fav-pulse'), 450);
  }
  saveFavs();
  updateFavChip();
  updateSubtitle();
  if (state.currentFilter === 'fav') {
    render();
  } else {
    const btn = e.currentTarget;
    btn.classList.toggle('active', photo.fav);
    btn.setAttribute('aria-label', photo.fav ? 'Retirer des favoris' : 'Ajouter aux favoris');
    if (state.lightboxIdx === id) window.updateLbFavBtn?.();
  }
}

export function saveFavs() {
  localStorage.setItem(`favs_${state.eventSlug}`, JSON.stringify(state.photos.filter(p => p.fav).map(p => p.src)));
}

export function updateFavChip() {
  const chip = document.getElementById('favChip');
  const count = state.photos.filter(p => p.fav).length;
  if (chip) chip.textContent = count > 0 ? `Favoris (${count})` : 'Favoris';
}

// ── Téléchargements ────────────────────────────────────────

export async function downloadAll() {
  const list = getFiltered();
  if (!list.length) { showToast('Aucune photo à télécharger'); return; }
  await downloadAsZip(list, `${state.eventSlug || 'soiree'}_photos.zip`, 'photo');
}

export async function downloadFavorites() {
  const favs = state.photos.filter(p => p.fav);
  if (!favs.length) { showToast('Aucun favori à télécharger'); return; }
  await downloadAsZip(favs, `${state.eventSlug || 'soiree'}_favoris.zip`, 'favori');
}

async function downloadAsZip(photoList, zipName, prefix) {
  if (typeof JSZip === 'undefined') { showToast('Erreur : JSZip non chargé'); return; }
  const zip = new JSZip();
  const total = photoList.length;
  showToast(`Préparation… 0/${total}`);
  for (let i = 0; i < total; i++) {
    const p = photoList[i];
    try {
      const resp = await fetch(p.src);
      if (!resp.ok) continue;
      const blob = await resp.blob();
      const ext = p.src.split('.').pop() || 'jpg';
      zip.file(`${prefix}_${String(i + 1).padStart(3, '0')}.${ext}`, blob);
      showToast(`Téléchargement… ${i+1}/${total}`);
    } catch {}
  }
  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url; a.download = zipName; a.click();
  URL.revokeObjectURL(url);
  showToast(`✅ ${total} photo${total > 1 ? 's' : ''} téléchargée${total > 1 ? 's' : ''}`);
}

// ── Subtitle / stats ───────────────────────────────────────

export function updateSubtitle() {
  const { photos } = state;
  const count = photos.length;
  const favs  = photos.filter(p => p.fav).length;
  let txt = `${count} photo${count > 1 ? 's' : ''}`;
  if (favs > 0) txt += ` · ${favs} favori${favs > 1 ? 's' : ''}`;
  const sub = document.getElementById('subtitle');
  if (sub) sub.innerHTML = `${txt} <span class="shortcut-hint" onclick="showShortcutsHelp(); return false;" title="Raccourcis clavier"><kbd>?</kbd></span>`;
  const menuFav = document.getElementById('headerMenuFav');
  if (menuFav) menuFav.style.display = favs > 0 ? 'flex' : 'none';
}

export function updateFilterContext() {
  const { currentFilter, photos } = state;
  const el = document.getElementById('filterContext');
  if (!el) return;
  if (currentFilter === 'all' || currentFilter === 'fav') { el.textContent = ''; return; }
  const count = photos.filter(p => p.hour === currentFilter).length;
  el.textContent = `${currentFilter} · ${count} photo${count > 1 ? 's' : ''}`;
}

export function showSkeletonLoading() {
  const grid = document.getElementById('photoGrid');
  if (!grid) return;
  let html = '<div class="skeleton-grid">';
  for (let i = 0; i < 12; i++) html += `<div class="skeleton-card" style="height:${150 + Math.random()*200}px"></div>`;
  grid.innerHTML = html + '</div>';
}

export function animateCounter(target, elementId, duration = 1500) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const start = performance.now();
  const tick = t => {
    const p = Math.min((t - start) / duration, 1);
    const ease = 1 - Math.pow(1 - p, 4);
    el.textContent = Math.floor(ease * target);
    if (p < 1) requestAnimationFrame(tick);
    else el.textContent = target;
  };
  requestAnimationFrame(tick);
}

// ── Timeline / filtres par heure ───────────────────────────

export function hourChronoOrder(hour) {
  const ids = state.photos.filter(p => p.hour === hour).map(p => p.sortIndex ?? p.id);
  return ids.length ? Math.min(...ids) : 0;
}

function isUnknownHour(hour) {
  if (hour !== '00h') return false;
  const group = state.photos.filter(p => p.hour === '00h');
  return group.length > 0 && group.every(p => !p.date || p.time === '00:00');
}

export function formatSectionLabel(p) {
  if (p.date) {
    const d = new Date(`${p.date}T12:00:00`);
    const day = d.toLocaleDateString('fr-FR', { weekday:'short', day:'numeric', month:'short' });
    return `${day} · ${p.hour}`;
  }
  return p.hour || '';
}

export function buildHourFilters() {
  const { photos } = state;
  const tl = document.getElementById('timeline');
  if (!tl) return;
  const hours = [...new Set(photos.map(p => p.hour))].filter(h => !isUnknownHour(h))
    .sort((a, b) => hourChronoOrder(a) - hourChronoOrder(b));

  const points = hours.map(h => {
    const count = photos.filter(p => p.hour === h).length;
    return `<button type="button" class="timeline-point" role="tab" data-hour="${h}"
      onclick="setFilter('${h}', this)" aria-label="${h} (${count} photos)">
      <div class="timeline-dot"></div>
      <span class="timeline-label">${h}</span>
    </button>`;
  }).join('');

  tl.innerHTML = `
    <div class="timeline-scroll">
      <div class="timeline-track">
        <div class="timeline-line-track"></div>
        <div class="timeline-line-fill" id="timelineFill"></div>
        <div class="timeline-points">${points}</div>
      </div>
    </div>`;
}

export function buildStoriesBar() {
  const scroll = document.getElementById('storiesScroll');
  if (!scroll || !state.photos.length) return;
  const { photos } = state;
  const hours = [...new Set(photos.map(p => p.hour))]
    .filter(h => !isUnknownHour(h))
    .sort((a, b) => hourChronoOrder(a) - hourChronoOrder(b));

  const first = photos[0];
  let html = `<button type="button" class="story-bubble" data-label="Tout"
    style="background-image:url('${encodeURI(first?.thumb||first?.src||'')}')"
    onclick="openGlobalStory()" aria-label="Voir la Story complète"></button>`;

  hours.forEach(h => {
    const fp = photos.find(p => p.hour === h);
    html += `<button type="button" class="story-bubble" data-label="${h}" data-hour="${h}"
      style="background-image:url('${encodeURI(fp?.thumb||fp?.src||'')}')"
      onclick="openFilteredStory('${h}')" aria-label="Voir la Story de ${h}"></button>`;
  });
  scroll.innerHTML = html;
}

export function showShortcutsHelp() {
  let overlay = document.getElementById('shortcuts-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'shortcuts-overlay';
    overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:99999;
      display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);`;
    overlay.innerHTML = `<div style="background:var(--surface);border-radius:16px;padding:32px;max-width:380px;width:90%;font-family:var(--font)">
      <h3 style="margin:0 0 16px;color:var(--text);font-size:18px">Raccourcis clavier</h3>
      <div style="display:grid;gap:8px;font-size:13px;color:var(--text-secondary)">
        <div><kbd>←</kbd> <kbd>→</kbd> Photo précédente / suivante</div>
        <div><kbd>Esc</kbd> Fermer</div>
        <div><kbd>F</kbd> Ajouter aux favoris</div>
        <div><kbd>Space</kbd> Pause diaporama</div>
      </div>
      <button onclick="document.getElementById('shortcuts-overlay').remove()"
        style="margin-top:20px;padding:10px 20px;background:var(--accent-warm);color:#fff;border:none;border-radius:8px;cursor:pointer;font-family:var(--font);font-size:14px">Fermer</button>
    </div>`;
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  }
}

export function initHeaderMenu() {
  const btn  = document.getElementById('headerMenuBtn');
  const menu = document.getElementById('headerMenu');
  if (!btn || !menu) return;
  btn.addEventListener('click', e => {
    e.stopPropagation();
    menu.classList.toggle('hidden');
    btn.setAttribute('aria-expanded', !menu.classList.contains('hidden'));
  });
  document.addEventListener('click', () => closeHeaderMenu());
  menu.addEventListener('click', e => e.stopPropagation());
}

export function closeHeaderMenu() {
  document.getElementById('headerMenu')?.classList.add('hidden');
  document.getElementById('headerMenuBtn')?.setAttribute('aria-expanded', 'false');
}

export function updateFooterBg() {
  const bg = document.getElementById('siteFooterBg');
  const { photos } = state;
  if (!bg || !photos.length) return;
  const last = photos[photos.length - 1];
  bg.style.backgroundImage = `url('${encodeURI(last.thumb || last.src)}')`;
}
