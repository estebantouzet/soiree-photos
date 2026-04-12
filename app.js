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

/* ── DIAPORAMA ────────────────────────────────────────────── */

let slideshowInterval = null;  // interval ID pour le diaporama
let slideshowPaused = false;     // état pause/play
const SLIDESHOW_DELAY = 3000;    // 3 secondes entre chaque photo

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

    // Précharge les images avec barre de progression
    await preloadImagesWithProgress();

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

/* ── PRÉCHARGEMENT IMAGES ───────────────────────────────── */

async function preloadImagesWithProgress() {
  const total = photos.length;
  if (total === 0) return;

  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');
  const loadingContainer = document.getElementById('loadingContainer');

  let loaded = 0;

  // Met à jour la barre de progression
  const updateProgress = () => {
    loaded++;
    const percent = (loaded / total) * 100;
    if (progressBar) progressBar.style.width = `${percent}%`;
    if (progressText) progressText.textContent = `Chargement… ${loaded}/${total} photos`;

    // Si toutes les images sont chargées, masque la barre avec transition
    if (loaded >= total) {
      if (loadingContainer) {
        loadingContainer.classList.add('hidden');
      }
    }
  };

  // Précharge chaque image
  const promises = photos.map(p => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        updateProgress();
        resolve();
      };
      img.onerror = () => {
        // Même en cas d'erreur, on continue
        updateProgress();
        resolve();
      };
      // Utilise la miniature si disponible, sinon l'originale
      img.src = p.thumb || p.src;
    });
  });

  await Promise.all(promises);
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
    // Utilise la miniature pour la grille, fallback sur src si absent
    const thumbSrc = p.thumb || p.src;
    return `
      <div class="photo-card" onclick="openLightbox(${p.id})">
        <img
          data-src="${escHtml(thumbSrc)}"
          alt="${escHtml(p.caption || p.time || '')}"
          class="lazy-img"
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

  // Déclencher le lazy loading sur les nouvelles images
  observeLazyImages();
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
  stopSlideshow();
  document.getElementById('lightbox').classList.remove('open');
  document.body.style.overflow = '';
  lightboxIdx = null;
}

function handleLightboxClick(e) {
  if (e.target === document.getElementById('lightbox')) closeLightbox();
}

/* ── NAVIGATION LIGHTBOX ───────────────────────────────── */

function prevPhoto() {
  if (lightboxIdx === null) return;
  const list = getFiltered();
  if (!list.length) return;
  
  // Trouve l'index actuel dans la liste filtrée
  const currentIndex = list.findIndex(p => p.id === lightboxIdx);
  if (currentIndex === -1) return;
  
  // Photo précédente (ou dernière si au début)
  const prevIndex = (currentIndex - 1 + list.length) % list.length;
  openLightbox(list[prevIndex].id);
}

function nextPhoto() {
  if (lightboxIdx === null) return;
  const list = getFiltered();
  if (!list.length) return;
  
  // Trouve l'index actuel dans la liste filtrée
  const currentIndex = list.findIndex(p => p.id === lightboxIdx);
  if (currentIndex === -1) return;
  
  // Photo suivante (ou première si à la fin)
  const nextIndex = (currentIndex + 1) % list.length;
  openLightbox(list[nextIndex].id);
}

/* ── DIAPORAMA ────────────────────────────────────────────── */

function startSlideshow() {
  const list = getFiltered();
  if (!list.length) {
    showToast('Aucune photo à afficher');
    return;
  }
  
  // Ouvre la première photo filtrée
  openLightbox(list[0].id);
  
  // Active le diaporama
  slideshowPaused = false;
  updatePauseButton();
  
  // Affiche le bouton pause
  document.getElementById('lbPauseBtn').style.display = 'inline-flex';
  
  // Démarre l'interval
  stopSlideshow(); // Clear any existing interval first
  slideshowInterval = setInterval(nextSlide, SLIDESHOW_DELAY);
}

function stopSlideshow() {
  if (slideshowInterval) {
    clearInterval(slideshowInterval);
    slideshowInterval = null;
  }
  slideshowPaused = false;
  // Cache le bouton pause
  const pauseBtn = document.getElementById('lbPauseBtn');
  if (pauseBtn) pauseBtn.style.display = 'none';
}

function nextSlide() {
  if (slideshowPaused || lightboxIdx === null) return;
  
  const list = getFiltered();
  if (!list.length) {
    stopSlideshow();
    return;
  }
  
  // Trouve l'index actuel dans la liste filtrée
  const currentIndex = list.findIndex(p => p.id === lightboxIdx);
  if (currentIndex === -1) {
    // La photo actuelle n'est pas dans les filtrées, retourne au début
    openLightbox(list[0].id);
    return;
  }
  
  // Passe à la photo suivante (ou retourne au début si fin)
  const nextIndex = (currentIndex + 1) % list.length;
  openLightbox(list[nextIndex].id);
}

function toggleSlideshowPause() {
  slideshowPaused = !slideshowPaused;
  updatePauseButton();
}

function updatePauseButton() {
  const btn = document.getElementById('lbPauseBtn');
  const icon = document.getElementById('lbPauseIcon');
  const label = document.getElementById('lbPauseLabel');
  
  if (!btn || !icon || !label) return;
  
  if (slideshowPaused) {
    // Affiche icône play (triangle)
    icon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
    label.textContent = 'Lecture';
  } else {
    // Affiche icône pause (deux barres)
    icon.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
    label.textContent = 'Pause';
  }
}

function updateLbFavBtn() {
  if (lightboxIdx === null) return;
  const p   = photos[lightboxIdx];
  const btn = document.getElementById('lbFavBtn');
  const ico = document.getElementById('lbFavIcon');
  const span = btn.querySelector('span');
  btn.classList.toggle('active', p.fav);
  ico.style.fill   = p.fav ? '#fff' : 'none';
  ico.style.stroke = '#fff';
  if (span) {
    span.textContent = p.fav ? 'Favori ✓' : 'Favori';
  }
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

async function downloadAll() {
  const list = getFiltered();
  if (!list.length) { showToast('Aucune photo à télécharger'); return; }

  await downloadAsZip(list, 'soiree_photos.zip', 'photo');
}

async function downloadFavorites() {
  const favs = photos.filter(p => p.fav);
  if (!favs.length) { showToast('Aucun favori à télécharger'); return; }

  await downloadAsZip(favs, 'soiree_favoris.zip', 'favori');
}

async function downloadAsZip(photoList, zipName, prefix) {
  if (typeof JSZip === 'undefined') {
    showToast('Erreur : JSZip non chargé');
    return;
  }

  const zip = new JSZip();
  const total = photoList.length;

  showToast(`Préparation du zip… 0/${total}`);

  for (let i = 0; i < total; i++) {
    const p = photoList[i];
    try {
      // Utilise p.src (fichier original), pas la miniature
      const response = await fetch(p.src);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();

      // Nom de fichier : soiree_[prefix]_[index]_[heure].ext
      const ext = p.src.split('.').pop() || 'jpg';
      const filename = `soiree_${prefix}_${String(i + 1).padStart(3, '0')}_${(p.time || 'photo').replace(':', 'h')}.${ext}`;
      zip.file(filename, blob);

      showToast(`Préparation du zip… ${i + 1}/${total}`);
    } catch (err) {
      console.error(`Erreur sur ${p.src}:`, err);
    }
  }

  showToast('Création du zip…');

  try {
    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = zipName;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`${total} photo${total > 1 ? 's' : ''} téléchargée${total > 1 ? 's' : ''} !`);
  } catch (err) {
    console.error('Erreur création zip:', err);
    showToast('Erreur lors de la création du zip');
  }
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

/* ── LAZY LOADING ────────────────────────────────────────── */

let lazyObserver = null;

function observeLazyImages() {
  // Créer l'observer une seule fois
  if (!lazyObserver) {
    lazyObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          const src = img.getAttribute('data-src');
          if (src) {
            img.src = src;
            img.removeAttribute('data-src');
            img.classList.remove('lazy-img');
            img.classList.add('loaded');
          }
          lazyObserver.unobserve(img);
        }
      });
    }, {
      rootMargin: '100px', // Charge un peu avant d'entrer dans le viewport
      threshold: 0.01
    });
  }

  // Observer toutes les images lazy
  document.querySelectorAll('img.lazy-img').forEach(img => {
    lazyObserver.observe(img);
  });
}

/* ── CLAVIER ─────────────────────────────────────────────── */

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft') prevPhoto();
  if (e.key === 'ArrowRight') nextPhoto();
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

/* ── SWIPE LIGHTBOX (MOBILE) ─────────────────────────────── */

(function setupLightboxSwipe() {
  const lightbox = document.getElementById('lightbox');
  let touchStartX = 0;
  let touchEndX = 0;
  const minSwipeDistance = 50; // Distance minimale pour considérer un swipe

  lightbox.addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });

  lightbox.addEventListener('touchend', e => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
  }, { passive: true });

  function handleSwipe() {
    const swipeDistance = touchEndX - touchStartX;
    
    if (Math.abs(swipeDistance) > minSwipeDistance) {
      if (swipeDistance > 0) {
        // Swipe vers la droite → photo précédente
        prevPhoto();
      } else {
        // Swipe vers la gauche → photo suivante
        nextPhoto();
      }
    }
  }
})();

/* ── LANCEMENT ───────────────────────────────────────────── */

init();
