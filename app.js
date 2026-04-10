/* ─────────────────────────────────────────────────────────
   app.js — Galerie photo de soirée
   Charge photos.json, gère filtres, recherche, favoris,
   lightbox et téléchargements.
───────────────────────────────────────────────────────── */

let photos = [];          // toutes les photos chargées
let currentFilter = 'all';
let searchQuery = '';
let sortAsc = false;      // false = plus récent en premier
let lightboxIdx = null;   // index dans photos[] de la photo ouverte
let gridColumns = 2;      // 2 ou 4 colonnes pour la grille

/* ── CHARGEMENT INITIAL ─────────────────────────────────── */

async function init() {
  try {
    const res = await fetch('photos.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    photos = await res.json();

    // Récupère les favoris sauvegardés dans le navigateur
    const savedFavs = JSON.parse(localStorage.getItem('favs') || '[]');
    photos.forEach(p => { p.fav = savedFavs.includes(p.src); });

    // Récupère la préférence de grille (2 ou 4 colonnes)
    gridColumns = parseInt(localStorage.getItem('gridColumns') || '2');
    document.getElementById('photoGrid').className = `grid grid-${gridColumns}`;

    buildHourFilters();
    render();
    updateSubtitle();
  } catch (err) {
    document.getElementById('photoGrid').innerHTML = `
      <div class="empty" style="grid-column:1/-1">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <strong>Impossible de charger photos.json</strong>
        <span>Lance d'abord generate_json.py puis place tes photos dans le dossier photos/</span>
      </div>`;
    console.error('Erreur chargement photos.json :', err);
  }
}

/* ── SOUS-TITRE ─────────────────────────────────────────── */

function updateSubtitle() {
  const count = photos.length;
  const favs  = photos.filter(p => p.fav).length;
  let txt = `${count} photo${count > 1 ? 's' : ''}`;
  if (favs > 0) txt += ` · ${favs} favori${favs > 1 ? 's' : ''}`;
  document.getElementById('subtitle').textContent = txt;

  // Toggle download favorites button visibility
  const favBtn = document.getElementById('downloadFavBtn');
  if (favBtn) favBtn.style.display = favs > 0 ? 'inline-flex' : 'none';
}

/* ── CONSTRUCTION DES FILTRES PAR HEURE ─────────────────── */

function buildHourFilters() {
  const hours = [...new Set(photos.map(p => p.hour))].sort();
  const container = document.getElementById('filters');

  hours.forEach(h => {
    const btn = document.createElement('button');
    btn.className = 'filter-chip';
    btn.textContent = h;
    btn.onclick = () => setFilter(h, btn);
    container.appendChild(btn);
  });

  // Chip Favoris (toujours en dernier)
  const favBtn = document.createElement('button');
  favBtn.className = 'filter-chip';
  favBtn.id = 'favChip';
  favBtn.onclick = () => setFilter('fav', favBtn);
  container.appendChild(favBtn);
  updateFavChip();
}

function updateFavChip() {
  const chip = document.getElementById('favChip');
  if (!chip) return;
  const count = photos.filter(p => p.fav).length;
  chip.innerHTML = count > 0
    ? `Favoris <span class="fav-chip-count">${count}</span>`
    : 'Favoris';
}

/* ── FILTRAGE ────────────────────────────────────────────── */

function getFiltered() {
  let list = [...photos];

  if (currentFilter === 'fav') {
    list = list.filter(p => p.fav);
  } else if (currentFilter !== 'all') {
    list = list.filter(p => p.hour === currentFilter);
  }

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter(p =>
      (p.caption || '').toLowerCase().includes(q) ||
      (p.time || '').includes(q)
    );
  }

  list.sort((a, b) =>
    sortAsc
      ? (a.time || '').localeCompare(b.time || '')
      : (b.time || '').localeCompare(a.time || '')
  );

  return list;
}

/* ── RENDU DE LA GRILLE ─────────────────────────────────── */

function render() {
  const list    = getFiltered();
  const grid    = document.getElementById('photoGrid');
  const counter = document.getElementById('statsCount');

  counter.textContent = `${list.length} photo${list.length !== 1 ? 's' : ''}`;

  if (!list.length) {
    grid.innerHTML = `
      <div class="empty">
        <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        Aucune photo trouvée
      </div>`;
    return;
  }

  grid.innerHTML = list.map(p => {
    const captionHtml = p.caption
      ? `<p class="photo-caption">${escHtml(p.caption)}</p>`
      : '';
    return `
      <div class="photo-card" onclick="openLightbox(${p.id})">
        <img
          src="${escHtml(p.src)}"
          alt="${escHtml(p.caption || p.time || '')}"
          loading="lazy"
        />
        <div class="photo-overlay">
          ${captionHtml}
          <p class="photo-time">${escHtml(p.time || '')}</p>
        </div>
        <button
          class="fav-btn ${p.fav ? 'active' : ''}"
          onclick="toggleFav(event, ${p.id})"
          aria-label="${p.fav ? 'Retirer des favoris' : 'Ajouter aux favoris'}"
        >
          <svg viewBox="0 0 24 24">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </button>
      </div>`;
  }).join('');
}

/* ── ACTIONS UTILISATEUR ─────────────────────────────────── */

function setFilter(f, el) {
  currentFilter = f;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  render();
}

function filterPhotos() {
  searchQuery = document.getElementById('searchInput').value.trim();
  document.getElementById('clearBtn').style.display = searchQuery ? 'block' : 'none';
  render();
}

function clearSearch() {
  document.getElementById('searchInput').value = '';
  searchQuery = '';
  document.getElementById('clearBtn').style.display = 'none';
  render();
}

function toggleSort() {
  sortAsc = !sortAsc;
  document.getElementById('sortLabel').textContent = sortAsc ? 'Plus ancien' : 'Plus récent';
  render();
}

function toggleGrid() {
  // Cycle: 2 -> 3 -> 4 -> 2
  gridColumns = gridColumns === 2 ? 3 : (gridColumns === 3 ? 4 : 2);
  localStorage.setItem('gridColumns', gridColumns);
  document.getElementById('photoGrid').className = `grid grid-${gridColumns}`;
  const label = gridColumns === 2 ? 'grandes photos' : (gridColumns === 3 ? 'photos moyennes' : 'petites photos');
  showToast(`Vue : ${label}`);
}

/* ── FAVORIS ─────────────────────────────────────────────── */

function toggleFav(e, id) {
  e.stopPropagation();
  photos[id].fav = !photos[id].fav;
  saveFavs();
  updateFavChip();
  updateSubtitle();
  render();
}

function saveFavs() {
  const favSrcs = photos.filter(p => p.fav).map(p => p.src);
  localStorage.setItem('favs', JSON.stringify(favSrcs));
}

/* ── LIGHTBOX ────────────────────────────────────────────── */

function openLightbox(id) {
  lightboxIdx = id;
  const p = photos[id];
  document.getElementById('lbImg').src    = p.src;
  document.getElementById('lbImg').alt    = p.caption || '';
  document.getElementById('lbCaption').textContent = p.caption || '(pas de légende)';
  document.getElementById('lbTime').textContent    = p.time    || '';
  updateLbFavBtn();
  document.getElementById('lightbox').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('open');
  document.body.style.overflow = '';
  lightboxIdx = null;
}

function handleLightboxClick(e) {
  if (e.target === document.getElementById('lightbox')) closeLightbox();
}

function updateLbFavBtn() {
  if (lightboxIdx === null) return;
  const p   = photos[lightboxIdx];
  const btn = document.getElementById('lbFavBtn');
  const ico = document.getElementById('lbFavIcon');
  btn.classList.toggle('active', p.fav);
  ico.style.fill   = p.fav ? '#fff' : 'none';
  ico.style.stroke = '#fff';
  btn.querySelector('svg').nextSibling
    ? btn.childNodes[btn.childNodes.length - 1].textContent = p.fav ? ' Favori ✓' : ' Favori'
    : null;
}

function toggleLightboxFav() {
  if (lightboxIdx === null) return;
  photos[lightboxIdx].fav = !photos[lightboxIdx].fav;
  saveFavs();
  updateFavChip();
  updateSubtitle();
  updateLbFavBtn();
  render();
}

/* ── TÉLÉCHARGEMENTS ─────────────────────────────────────── */

function downloadSingle() {
  if (lightboxIdx === null) return;
  const p = photos[lightboxIdx];
  triggerDownload(p.src, `soiree_${(p.time || 'photo').replace(':', 'h')}.jpg`);
}

function downloadAll() {
  const list = getFiltered();
  if (!list.length) { showToast('Aucune photo à télécharger'); return; }

  showToast(`Téléchargement de ${list.length} photo${list.length > 1 ? 's' : ''}…`);
  list.forEach((p, i) => {
    setTimeout(() => {
      triggerDownload(p.src, `soiree_${String(i + 1).padStart(3, '0')}_${(p.time || 'photo').replace(':', 'h')}.jpg`);
    }, i * 150);
  });
}

function downloadFavorites() {
  const favs = photos.filter(p => p.fav);
  if (!favs.length) { showToast('Aucun favori à télécharger'); return; }

  showToast(`Téléchargement de ${favs.length} favori${favs.length > 1 ? 's' : ''}…`);
  favs.forEach((p, i) => {
    setTimeout(() => {
      triggerDownload(p.src, `soiree_favori_${String(i + 1).padStart(3, '0')}_${(p.time || 'photo').replace(':', 'h')}.jpg`);
    }, i * 150);
  });
}

function triggerDownload(src, filename) {
  const a = document.createElement('a');
  a.href     = src;
  a.download = filename;
  a.click();
}

/* ── TOAST ───────────────────────────────────────────────── */

let toastTimer = null;

function showToast(msg) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

/* ── UTILITAIRES ─────────────────────────────────────────── */

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── CLAVIER ─────────────────────────────────────────────── */

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeLightbox();
});

/* ── PINCH TO ZOOM (MOBILE) ──────────────────────────────── */

(function setupPinchZoom() {
  const grid = document.getElementById('photoGrid');
  let initialDistance = 0;
  let initialColumns = 2;
  let isPinching = false;
  let lastPinchTime = 0;

  function getDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  grid.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      isPinching = true;
      initialDistance = getDistance(e.touches);
      initialColumns = gridColumns;
      e.preventDefault();
    }
  }, { passive: false });

  grid.addEventListener('touchmove', e => {
    if (!isPinching || e.touches.length !== 2) return;
    e.preventDefault();

    // Debounce: wait 300ms between pinch actions
    const now = Date.now();
    if (now - lastPinchTime < 300) return;

    const currentDistance = getDistance(e.touches);
    const diff = currentDistance - initialDistance;
    const threshold = 50; // minimum pixels to trigger

    if (Math.abs(diff) > threshold) {
      if (diff > 0 && gridColumns > 2) {
        // Pinch out (zoom in) → fewer columns, bigger photos
        gridColumns--;
      } else if (diff < 0 && gridColumns < 4) {
        // Pinch in (zoom out) → more columns, smaller photos
        gridColumns++;
      }

      localStorage.setItem('gridColumns', gridColumns);
      grid.className = `grid grid-${gridColumns}`;
      const label = gridColumns === 2 ? 'grandes photos' : (gridColumns === 3 ? 'photos moyennes' : 'petites photos');
      showToast(`Vue : ${label}`);

      lastPinchTime = now;
      initialDistance = currentDistance;
    }
  }, { passive: false });

  grid.addEventListener('touchend', () => {
    isPinching = false;
  });

  grid.addEventListener('touchcancel', () => {
    isPinching = false;
  });
})();

/* ── LANCEMENT ───────────────────────────────────────────── */

init();
