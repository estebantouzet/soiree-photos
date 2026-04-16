/* ─────────────────────────────────────────────────────────
   app.js — Galerie photo de soirée
   Charge photos.json, gère filtres, recherche, favoris,
   lightbox et téléchargements.
───────────────────────────────────────────────────────── */

// Haptic feedback helper
const haptic = (p = 10) => { if (navigator.vibrate) navigator.vibrate(p); };

let photos = [];          // toutes les photos chargées
let currentFilter = 'all';
let searchQuery = '';
let sortAsc = false;      // false = plus récent en premier
let lightboxIdx = null;   // index dans photos[] de la photo ouverte
let gridColumns = 2;

/* ── DIAPORAMA ────────────────────────────────────────────── */

let slideshowInterval = null;  // interval ID pour le diaporama
let slideshowPaused = false;     // état pause/play
let SLIDESHOW_DELAY = 4000;      // vitesse du diaporama (ms), défaut 4s

/* ── WELCOME SCREEN / SPLASH ──────────────────────────────── */

let gyroscopeActive = false;
let previewInterval = null;

// Vérifie si le splash a déjà été vu cette session
function checkWelcomeScreen() {
  const hasSeenSplash = sessionStorage.getItem('hasSeenSplash');
  const welcomeScreen = document.getElementById('welcome-screen');
  
  if (hasSeenSplash && welcomeScreen) {
    // Déjà vu : cache immédiatement
    welcomeScreen.classList.add('hidden');
    document.body.classList.remove('splash-open');
  } else {
    // Premier visite : affiche le splash
    document.body.classList.add('splash-open');
    // Démarre les animations
    initGyroscopeParallax();
    
    // Support touch pour le défloutage (fallback si :active ne suffit pas)
    const pc = document.querySelector('.preview-container');
    if (pc) {
      pc.ontouchstart = () => {
        haptic(10);
        pc.classList.add('active');
      };
      pc.ontouchend = () => pc.classList.remove('active');
    }
  }
}

// Animation du compteur (défile de 0 jusqu'au total)
function animateCounter() {
  const counterEl = document.getElementById('photo-count');
  const welcomeScreen = document.getElementById('welcome-screen');
  if (!counterEl || !welcomeScreen) return;
  
  const targetCount = parseInt(welcomeScreen.dataset.photoCount, 10) || 93;
  const duration = 1500; // 1.5 secondes
  const startTime = performance.now();
  const startValue = 0;
  
  function updateCounter(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Easing ease-out
    const easeOut = 1 - Math.pow(1 - progress, 3);
    const currentValue = Math.floor(startValue + (targetCount - startValue) * easeOut);
    
    counterEl.textContent = currentValue;
    
    if (progress < 1) {
      requestAnimationFrame(updateCounter);
    } else {
      counterEl.textContent = targetCount;
    }
  }
  
  requestAnimationFrame(updateCounter);
}

// Effet Gyroscope / Parallaxe
function initGyroscopeParallax() {
  const bg = document.getElementById('welcome-bg');
  if (!bg) return;
  
  // Détection iOS 13+ pour la permission
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  
  if (isIOS && typeof DeviceOrientationEvent !== 'undefined' && 
      typeof DeviceOrientationEvent.requestPermission === 'function') {
    // iOS 13+ : demande la permission au premier tap
    const requestBtn = document.querySelector('.welcome-btn');
    if (requestBtn) {
      requestBtn.addEventListener('click', async () => {
        try {
          const response = await DeviceOrientationEvent.requestPermission();
          if (response === 'granted') {
            startGyroscopeTracking(bg);
          }
        } catch (e) {
          console.log('Permission gyroscope refusée ou erreur');
        }
      }, { once: true });
    }
  } else {
    // Android ou ancien iOS : démarrage direct
    startGyroscopeTracking(bg);
  }
}

function startGyroscopeTracking(bgElement) {
  if (gyroscopeActive) return;
  gyroscopeActive = true;
  
  let lastBeta = 0;
  let lastGamma = 0;
  let rafId = null;
  
  // Paramètres de l'effet parallaxe
  const maxOffset = 20; // pixels max de déplacement
  const smoothing = 0.1; // Lissage pour fluidité
  
  function handleOrientation(event) {
    // beta: inclinaison avant-arrière (-180 à 180)
    // gamma: inclinaison gauche-droite (-90 à 90)
    const beta = event.beta || 0;
    const gamma = event.gamma || 0;
    
    // Normalise et limite les valeurs
    const normalizedBeta = Math.max(-45, Math.min(45, beta));
    const normalizedGamma = Math.max(-45, Math.min(45, gamma));
    
    // Objectif de déplacement
    const targetY = (normalizedBeta / 45) * maxOffset;
    const targetX = (normalizedGamma / 45) * maxOffset;
    
    // Interpolation douce
    lastBeta += (targetY - lastBeta) * smoothing;
    lastGamma += (targetX - lastGamma) * smoothing;
    
    // Annule la précédente frame si existe
    if (rafId) cancelAnimationFrame(rafId);
    
    // Applique le transform
    rafId = requestAnimationFrame(() => {
      bgElement.style.transform = `scale(1.1) translate3d(${-lastGamma}px, ${-lastBeta}px, 0)`;
    });
  }
  
  window.addEventListener('deviceorientation', handleOrientation, { passive: true });
  
  // Arrête l'effet quand le splash se ferme (économie batterie)
  const welcomeScreen = document.getElementById('welcome-screen');
  if (welcomeScreen) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.target.classList.contains('hidden')) {
          window.removeEventListener('deviceorientation', handleOrientation);
          if (rafId) cancelAnimationFrame(rafId);
          gyroscopeActive = false;
          observer.disconnect();
        }
      });
    });
    observer.observe(welcomeScreen, { attributes: true, attributeFilter: ['class'] });
  }
}

// Fonction appelée au clic sur le bouton
function enterGallery() {
  const welcomeScreen = document.getElementById('welcome-screen');
  
  if (welcomeScreen) {
    // Arrête la boucle de preview
    if (previewInterval) {
      clearInterval(previewInterval);
      previewInterval = null;
    }
    
    // Ajoute la classe pour l'effet élastique (curtain)
    welcomeScreen.classList.add('curtain-exit');
    
    // Petit délai pour laisser la classe s'appliquer avant l'animation
    requestAnimationFrame(() => {
      welcomeScreen.classList.add('hidden');
      document.body.classList.remove('splash-open');
    });
    
    // Marque comme vu pour cette session
    sessionStorage.setItem('hasSeenSplash', 'true');
    
    // Nettoie après l'animation
    setTimeout(() => {
      welcomeScreen.classList.remove('curtain-exit');
    }, 1000);
  }
}

// Preview animée du Splash Screen
function initHomePreview() {
  const previewImg = document.getElementById('preview-img');
  if (!previewImg || !photos.length) return;
  
  let currentIndex = 0;
  
  // Affiche la première image immédiatement
  previewImg.src = photos[0].thumb || photos[0].src;
  
  // Change l'image toutes les 100ms en boucle
  previewInterval = setInterval(() => {
    currentIndex = (currentIndex + 1) % photos.length;
    previewImg.src = photos[currentIndex].thumb || photos[currentIndex].src;
  }, 100);
}

// Vérifie au chargement de la page
document.addEventListener('DOMContentLoaded', checkWelcomeScreen);

/* ── CHARGEMENT INITIAL ─────────────────────────────────── */

// Ajouter le bouton scroll-to-top
const scrollTopBtn = document.createElement('button');
scrollTopBtn.className = 'scroll-top';
scrollTopBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M18 15l-6-6-6 6"/></svg>`;
scrollTopBtn.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
document.body.appendChild(scrollTopBtn);

// Header scroll effect
window.addEventListener('scroll', () => {
  const header = document.querySelector('.header');
  if (window.scrollY > 10) {
    header.classList.add('scrolled');
  } else {
    header.classList.remove('scrolled');
  }

  // Show/hide scroll-to-top button
  if (window.scrollY > 400) {
    scrollTopBtn.classList.add('visible');
  } else {
    scrollTopBtn.classList.remove('visible');
  }
});

// Préchargement des images pour le lightbox
const preloadCache = new Map();
function preloadImage(src) {
  if (preloadCache.has(src)) return preloadCache.get(src);
  const promise = new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
  preloadCache.set(src, promise);
  return promise;
}

function preloadAdjacentImages() {
  if (lightboxIdx === null) return;
  const list = getFiltered();
  if (!list.length) return;

  const currentIndex = list.findIndex(p => p.id === lightboxIdx);
  if (currentIndex === -1) return;

  // Précharge la photo précédente et suivante
  const prevIndex = (currentIndex - 1 + list.length) % list.length;
  const nextIndex = (currentIndex + 1) % list.length;

  preloadImage(list[prevIndex].src);
  preloadImage(list[nextIndex].src);
}

// Show skeleton loading
function showSkeletonLoading() {
  const grid = document.getElementById('photoGrid');
  const skeletonCount = 12;
  let skeletonHTML = '<div class="skeleton-grid">';
  for (let i = 0; i < skeletonCount; i++) {
    const height = 150 + Math.random() * 200; // Random heights for masonry effect
    skeletonHTML += `<div class="skeleton-card" style="height: ${height}px;"></div>`;
  }
  skeletonHTML += '</div>';
  grid.innerHTML = skeletonHTML;
}

// Précharge toutes les miniatures avec compteur
async function preloadAll() {
  const loadPerc = document.getElementById('load-perc');
  const loadStatus = document.getElementById('load-status');
  const preloader = document.getElementById('preloader');
  
  if (!photos.length || !preloader) return;
  
  const totalImages = photos.length;
  let loadedCount = 0;
  
  const updateProgress = () => {
    const percentage = Math.round((loadedCount / totalImages) * 100);
    if (loadPerc) loadPerc.textContent = `${percentage}%`;
    
    // Change le texte selon l'avancement
    if (loadStatus) {
      if (percentage < 30) {
        loadStatus.textContent = 'Préparation du flash...';
      } else if (percentage < 60) {
        loadStatus.textContent = 'Flash activé...';
      } else if (percentage < 90) {
        loadStatus.textContent = 'Mise au point...';
      } else {
        loadStatus.textContent = 'Développement...';
      }
    }
    
    // Quand 100% atteint, attend 500ms puis cache le preloader et démarre les animations
    if (loadedCount === totalImages) {
      setTimeout(() => {
        if (preloader) preloader.classList.add('hidden');
        // Déclenche les animations du splash screen
        const welcomeScreen = document.getElementById('welcome-screen');
        if (welcomeScreen) welcomeScreen.classList.add('start-anim');
        animateCounter();
      }, 500);
    }
  };
  
  // Crée des promesses pour chaque image
  const loadPromises = photos.map((photo) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        loadedCount++;
        updateProgress();
        resolve();
      };
      img.onerror = () => {
        loadedCount++;
        updateProgress();
        resolve(); // Continue même si une image échoue
      };
      img.src = photo.thumb || photo.src;
    });
  });
  
  await Promise.all(loadPromises);
}

async function init() {
  // Show skeleton loading first
  showSkeletonLoading();

  try {
    const res = await fetch('photos.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    photos = await res.json();

    // Précharge toutes les miniatures avant d'afficher le splash
    await preloadAll();

    // Démarre la preview animée du splash screen
    initHomePreview();

    // Récupère les favoris sauvegardés dans le navigateur
    const savedFavs = JSON.parse(localStorage.getItem('favs') || '[]');
    photos.forEach(p => { p.fav = savedFavs.includes(p.src); });

    buildHourFilters();
    gridColumns = parseInt(localStorage.getItem('gridColumns') || '2');
    applyGrid();
    render();
    updateSubtitle();
    
    // Active le Livre d'Or side-drawer
    initGuestbook();
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
  // Réinitialise le lazyObserver pour éviter les références mortes
  if (lazyObserver) {
    lazyObserver.disconnect();
    lazyObserver = null;
  }

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
    // Utilise la miniature pour la grille, fallback sur src si absent
    const thumbSrc = p.thumb || p.src;
    return `
      <div class="photo-card" onclick="openLightbox(${p.id})">
        <img
          data-src="${escHtml(thumbSrc)}"
          alt="${escHtml(p.time || '')}"
          class="lazy-img"
        />
        <div class="photo-overlay">
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

  // Scroll Reveal - anime les photos au scroll avec délai aléatoire
  initScrollReveal();
}

/* ── SCROLL REVEAL ─────────────────────────────────────────── */
let revealObserver = null;

function initScrollReveal() {
  const cards = document.querySelectorAll('.photo-card:not(.visible)');
  
  revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry, index) => {
      if (entry.isIntersecting) {
        // Délai aléatoire entre 0 et 300ms pour effet organique
        const delay = Math.random() * 300;
        setTimeout(() => {
          entry.target.classList.add('visible');
        }, delay);
        revealObserver.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.15,
    rootMargin: '0px 0px -50px 0px'
  });

  cards.forEach(card => {
    revealObserver.observe(card);
  });
}

/* ── ACTIONS UTILISATEUR ─────────────────────────────────── */

function setFilter(f, el) {
  currentFilter = f;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  render();
}

function toggleSort() {
  sortAsc = !sortAsc;
  document.getElementById('sortLabel').textContent = sortAsc ? 'Plus ancien' : 'Plus récent';
  render();
}

function toggleGrid() {
  gridColumns = gridColumns === 2 ? 3 : (gridColumns === 3 ? 4 : 2);
  applyGrid();
  const label = gridColumns === 2 ? 'grandes photos' : (gridColumns === 3 ? 'photos moyennes' : 'petites photos');
  showToast(`Vue : ${label}`);
}

function applyGrid() {
  const grid = document.getElementById('photoGrid');
  grid.classList.remove('grid-2', 'grid-3', 'grid-4');
  grid.classList.add(`grid-${gridColumns}`);
  localStorage.setItem('gridColumns', gridColumns);
}

/* ── FAVORIS ─────────────────────────────────────────────── */

// Mini confetti effect
function triggerConfetti(x, y) {
  const colors = ['#e05555', '#ff6b6b', '#ff8e8e', '#ffb4b4'];
  const particleCount = 12;

  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    particle.style.cssText = `
      position: fixed;
      left: ${x}px;
      top: ${y}px;
      width: 6px;
      height: 6px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      border-radius: 50%;
      pointer-events: none;
      z-index: 1000;
    `;
    document.body.appendChild(particle);

    const angle = (Math.PI * 2 * i) / particleCount;
    const velocity = 30 + Math.random() * 30;
    const tx = Math.cos(angle) * velocity;
    const ty = Math.sin(angle) * velocity;

    particle.animate([
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
      { transform: `translate(${tx}px, ${ty}px) scale(0)`, opacity: 0 }
    ], {
      duration: 500 + Math.random() * 200,
      easing: 'cubic-bezier(0, .9, .57, 1)',
    }).onfinish = () => particle.remove();
  }
}

function toggleFav(e, id) {
  e.stopPropagation();
  haptic(15);
  const photo = photos.find(p => p.id === id);
  if (photo) {
    const wasFav = photo.fav;
    photo.fav = !photo.fav;

    // Confetti si on ajoute aux favoris
    if (!wasFav && photo.fav) {
      const rect = e.currentTarget.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      triggerConfetti(centerX, centerY);
    }
  }
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

async function openLightbox(id) {
  lightboxIdx = id;
  const p = photos.find(photo => photo.id === id);
  const lbImg = document.getElementById('lbImg');
  const lightbox = document.getElementById('lightbox');

  // Reset image state
  lbImg.classList.remove('loaded');
  lbImg.alt = p.time || '';
  document.getElementById('lbTime').textContent = p.time || '';

  // Show lightbox first with transition
  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';

  // Précharge l'image avant de l'afficher
  try {
    await preloadImage(p.src);
    lbImg.src = p.src;
    lbImg.classList.add('loaded');
  } catch (e) {
    // Fallback: affiche quand même
    lbImg.src = p.src;
    lbImg.classList.add('loaded');
  }

  updateLbFavBtn();

  // Précharge les images adjacentes
  preloadAdjacentImages();
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

  // Précharge les images adjacentes après la transition
  setTimeout(preloadAdjacentImages, 500);
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

  // Précharge les images adjacentes après la transition
  setTimeout(preloadAdjacentImages, 500);
}

/* ── DIAPORAMA ────────────────────────────────────────────── */

function launchSlideshow() {
  // Lance d'abord le diaporama (ouvre la lightbox)
  startSlideshow();
  
  // Puis active le plein écran après que la lightbox soit visible
  setTimeout(() => {
    const lightbox = document.getElementById('lightbox');
    try {
      if (lightbox.requestFullscreen) lightbox.requestFullscreen();
      else if (lightbox.webkitRequestFullscreen) lightbox.webkitRequestFullscreen();
    } catch (e) {}
  }, 50);
}

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
  
  // Affiche les contrôles
  document.getElementById('lbPauseBtn').style.display = 'inline-flex';
  document.getElementById('slideshowSpeedControls').style.display = 'flex';
  
  // Démarre l'interval (clear d'abord si déjà existant)
  if (slideshowInterval) {
    clearInterval(slideshowInterval);
    slideshowInterval = null;
  }
  slideshowInterval = setInterval(nextSlide, SLIDESHOW_DELAY);
  
  // Démarre l'effet Ken Burns
  startKenBurns();
}

function stopSlideshow() {
  if (slideshowInterval) {
    clearInterval(slideshowInterval);
    slideshowInterval = null;
  }
  slideshowPaused = false;
  
  // Cache les contrôles
  const pauseBtn = document.getElementById('lbPauseBtn');
  const speedControls = document.getElementById('slideshowSpeedControls');
  if (pauseBtn) pauseBtn.style.display = 'none';
  if (speedControls) speedControls.style.display = 'none';
  
  // Quitte le plein écran
  if (document.exitFullscreen) document.exitFullscreen();
  else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
  
  // Arrête l'effet Ken Burns
  stopKenBurns();
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
    startKenBurns();
    return;
  }
  
  // Passe à la photo suivante (ou retourne au début si fin)
  const nextIndex = (currentIndex + 1) % list.length;
  openLightbox(list[nextIndex].id);
  
  // Redémarre l'animation Ken Burns pour la nouvelle photo
  startKenBurns();
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

function setSlideshowSpeed(speed) {
  SLIDESHOW_DELAY = speed;
  
  // Met à jour la variable CSS pour l'animation Ken Burns
  document.documentElement.style.setProperty('--slide-duration', `${speed}ms`);
  
  // Met à jour les boutons actifs
  document.querySelectorAll('.speed-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.speed) === speed);
  });
  
  // Redémarre l'intervalle si le diaporama est actif
  if (slideshowInterval) {
    clearInterval(slideshowInterval);
    slideshowInterval = setInterval(nextSlide, SLIDESHOW_DELAY);
  }
  
  // Redémarre l'animation Ken Burns avec la nouvelle durée
  if (document.getElementById('lightbox').classList.contains('open')) {
    startKenBurns();
  }
}

/* ── EFFET KEN BURNS ─────────────────────────────────────── */

function startKenBurns() {
  const wrapper = document.getElementById('lbImgWrapper');
  const img = document.getElementById('lbImg');
  const progressBar = document.getElementById('lbProgressBar');
  const progressFill = document.getElementById('lbProgressFill');
  if (!wrapper || !img) return;
  
  // Supprime la classe pour réinitialiser l'animation
  img.classList.remove('ken-burns');
  
  // Réinitialise la barre de progression
  if (progressBar) progressBar.classList.remove('active');
  if (progressFill) progressFill.style.width = '0%';
  
  // Force un reflow pour que la suppression soit prise en compte
  void img.offsetWidth;
  
  // Choisit aléatoirement le type d'animation
  const zoomIn = Math.random() > 0.5;
  wrapper.dataset.zoom = zoomIn ? 'in' : 'out';
  
  // Ajoute la classe pour démarrer l'animation
  img.classList.add('ken-burns');
  
  // Active la barre de progression
  if (progressBar) progressBar.classList.add('active');
}

function stopKenBurns() {
  const img = document.getElementById('lbImg');
  const progressBar = document.getElementById('lbProgressBar');
  if (img) img.classList.remove('ken-burns');
  if (progressBar) progressBar.classList.remove('active');
}

function updateLbFavBtn() {
  if (lightboxIdx === null) return;
  const p = photos.find(photo => photo.id === lightboxIdx);
  if (!p) return;
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
  haptic(15);
  const photo = photos.find(p => p.id === lightboxIdx);
  if (photo) photo.fav = !photo.fav;
  saveFavs();
  updateFavChip();
  updateSubtitle();
  updateLbFavBtn();
  render();
}

/* ── TÉLÉCHARGEMENTS ─────────────────────────────────────── */

function downloadSingle() {
  if (lightboxIdx === null) return;
  const p = photos.find(photo => photo.id === lightboxIdx);
  if (!p) return;
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
            // Progressive loading with blur effect
            img.classList.add('loading');

            const newImg = new Image();
            newImg.onload = () => {
              img.src = src;
              img.classList.remove('lazy-img', 'loading');
              img.classList.add('loaded');
              lazyObserver.unobserve(img);
            };
            newImg.onerror = () => {
              // Fallback: load anyway
              img.src = src;
              img.classList.remove('lazy-img', 'loading');
              img.classList.add('loaded');
              lazyObserver.unobserve(img);
            };
            newImg.src = src;
          }
        }
      });
    }, {
      rootMargin: '150px', // Charge un peu avant d'entrer dans le viewport
      threshold: 0.01
    });
  }

  // Observer toutes les images lazy
  document.querySelectorAll('img.lazy-img').forEach(img => {
    lazyObserver.observe(img);
  });
}

/* ── CLAVIER ─────────────────────────────────────────────── */

// Aide des raccourcis clavier
function showShortcutsHelp() {
  const helpDiv = document.createElement('div');
  helpDiv.className = 'shortcuts-help';
  helpDiv.innerHTML = `
    <div class="shortcuts-overlay" onclick="hideShortcutsHelp()"></div>
    <div class="shortcuts-modal">
      <h3>Raccourcis clavier</h3>
      <div class="shortcuts-list">
        <div class="shortcut"><kbd>←</kbd> <span>Photo précédente</span></div>
        <div class="shortcut"><kbd>→</kbd> <span>Photo suivante</span></div>
        <div class="shortcut"><kbd>Space</kbd> <span>Pause / Lecture diaporama</span></div>
        <div class="shortcut"><kbd>F</kbd> <span>Ajouter aux favoris</span></div>
        <div class="shortcut"><kbd>D</kbd> <span>Télécharger la photo</span></div>
        <div class="shortcut"><kbd>Esc</kbd> <span>Fermer le lightbox</span></div>
        <div class="shortcut"><kbd>?</kbd> <span>Afficher cette aide</span></div>
      </div>
      <button class="shortcuts-close" onclick="hideShortcutsHelp()">Fermer</button>
    </div>
  `;
  document.body.appendChild(helpDiv);
  setTimeout(() => helpDiv.classList.add('visible'), 10);
}

function hideShortcutsHelp() {
  const helpDiv = document.querySelector('.shortcuts-help');
  if (helpDiv) {
    helpDiv.classList.remove('visible');
    setTimeout(() => helpDiv.remove(), 300);
  }
}

document.addEventListener('keydown', e => {
  // Ignore si un input est focus
  if (document.activeElement?.tagName === 'INPUT') return;

  if (e.key === '?') {
    showShortcutsHelp();
    return;
  }

  // Si le modal d'aide est ouvert, Escape le ferme
  if (document.querySelector('.shortcuts-help')) {
    if (e.key === 'Escape') {
      hideShortcutsHelp();
    }
    return;
  }

  if (e.key === 'Escape') {
    closeLightbox();
  } else if (e.key === 'ArrowLeft') {
    prevPhoto();
  } else if (e.key === 'ArrowRight' || e.key === ' ') {
    // Space = pause/play en mode diaporama, sinon next photo
    if (slideshowInterval && e.key === ' ') {
      e.preventDefault();
      toggleSlideshowPause();
    } else {
      nextPhoto();
    }
  } else if (e.key.toLowerCase() === 'f') {
    // F = toggle favori dans lightbox
    if (lightboxIdx !== null) {
      toggleLightboxFav();
    }
  } else if (e.key.toLowerCase() === 'd') {
    // D = download current photo
    if (lightboxIdx !== null) {
      downloadSingle();
    }
  }
});

/* ── PLEIN ÉCRAN ─────────────────────────────────────────── */

// Détecte si l'utilisateur quitte le plein écran manuellement (Échap)
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && slideshowInterval) {
    // L'utilisateur a quitté le plein écran, on arrête le diaporama
    stopSlideshow();
    closeLightbox();
  }
});

/* ── SWIPE LIGHTBOX (MOBILE) ─────────────────────────────── */

(function setupLightboxSwipe() {
  const lightbox = document.getElementById('lightbox');
  const lbImgWrapper = document.getElementById('lbImgWrapper');
  const lbImg = document.getElementById('lbImg');

  let touchStartX = 0;
  let touchStartY = 0;
  let touchCurrentX = 0;
  let touchCurrentY = 0;
  let isSwiping = false;
  let isVerticalSwipe = false;

  const minSwipeDistance = 50; // Distance minimale pour swipe horizontal
  const dismissThreshold = 150; // Distance pour fermer avec swipe down
  const maxDismissDistance = 300; // Distance max avant fermeture forcée

  lightbox.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;

    touchStartX = e.touches[0].screenX;
    touchStartY = e.touches[0].screenY;
    touchCurrentX = touchStartX;
    touchCurrentY = touchStartY;
    isSwiping = true;
    isVerticalSwipe = false;

    // Désactiver les transitions pendant le drag
    lbImg.style.transition = 'none';
    lightbox.style.transition = 'none';
  }, { passive: true });

  lightbox.addEventListener('touchmove', e => {
    if (!isSwiping || e.touches.length !== 1) return;

    touchCurrentX = e.touches[0].screenX;
    touchCurrentY = e.touches[0].screenY;

    const deltaX = touchCurrentX - touchStartX;
    const deltaY = touchCurrentY - touchStartY;

    // Déterminer la direction du swipe après 10px de mouvement
    if (!isVerticalSwipe && Math.abs(deltaY) > 10 && Math.abs(deltaY) > Math.abs(deltaX)) {
      isVerticalSwipe = true;
    }

    if (isVerticalSwipe && deltaY > 0) {
      // Swipe vers le bas : déplacer, rétrécir et réduire l'opacité
      const progress = Math.min(deltaY / maxDismissDistance, 1);
      const translateY = deltaY;
      const scale = 1 - (progress * 0.15); // Rétrécit jusqu'à 85%
      const opacity = 1 - (progress * 0.5); // Opacité descend à 50%

      lbImg.style.transform = `translateY(${translateY}px) scale(${scale})`;
      lightbox.style.background = `rgba(0, 0, 0, ${0.95 * opacity})`;
    }
  }, { passive: true });

  lightbox.addEventListener('touchend', e => {
    if (!isSwiping) return;

    isSwiping = false;

    // Réactiver les transitions
    lbImg.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.3s ease';
    lightbox.style.transition = 'background 0.3s ease';

    const deltaX = touchCurrentX - touchStartX;
    const deltaY = touchCurrentY - touchStartY;

    if (isVerticalSwipe && deltaY > dismissThreshold) {
      // Fermer la lightbox
      lbImg.style.transform = `translateY(${window.innerHeight}px) scale(0.8)`;
      lightbox.style.background = 'rgba(0, 0, 0, 0)';

      setTimeout(() => {
        closeLightbox();
        // Réinitialiser les styles après fermeture
        setTimeout(() => {
          lbImg.style.transform = '';
          lightbox.style.background = '';
        }, 50);
      }, 200);
    } else if (isVerticalSwipe) {
      // Revenir à la position initiale
      lbImg.style.transform = '';
      lightbox.style.background = '';
    } else if (Math.abs(deltaX) > minSwipeDistance) {
      // Swipe horizontal : changer de photo
      if (deltaX > 0) {
        prevPhoto();
      } else {
        nextPhoto();
      }
    }
  }, { passive: true });

  lightbox.addEventListener('touchcancel', () => {
    if (!isSwiping) return;

    isSwiping = false;
    isVerticalSwipe = false;

    // Réinitialiser avec transition
    lbImg.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    lbImg.style.transform = '';
    lightbox.style.transition = 'background 0.3s ease';
    lightbox.style.background = '';
  }, { passive: true });
})();

/* ── PARTAGE ────────────────────────────────────────────── */

async function shareSite() {
  const shareData = {
    title: 'Soirée de méchant salopard',
    text: 'Check les photos de la soirée ! 📸',
    url: window.location.href
  };
  try {
    if (navigator.share) {
      await navigator.share(shareData);
    } else {
      throw new Error();
    }
  } catch (err) {
    navigator.clipboard.writeText(window.location.href);
    alert('Lien copié dans le presse-papiers !');
  }
}

/* ─── LIVRE D'OR ─────────────────────────────────────────── */

// Configuration Firebase pour synchronisation des messages
const firebaseConfig = {
  apiKey: 'AIzaSyBkfWXioiQ00fENNPQgaN2D8GOsNhkoVVw',
  authDomain: 'livre-d-or-c3011.firebaseapp.com',
  databaseURL: 'https://livre-d-or-c3011-default-rtdb.europe-west1.firebasedatabase.app/',
  projectId: 'livre-d-or-c3011',
  storageBucket: 'livre-d-or-c3011.firebasestorage.app',
  messagingSenderId: '154185620344',
  appId: '1:154185620344:web:510a3ee6e4c1467ac4c68d'
};

// Variables globales Firebase
let guestbookDatabase = null;
let guestbookMessagesRef = null;
const guestbookEntries = []; // Cache local des messages
let messageCount = 0; // Compteur de messages pour le badge

/**
 * Échappe les caractères HTML pour la sécurité
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Initialise le Livre d'Or avec le side-drawer glassmorphism
 * Connecté à Firebase Realtime Database pour synchro multi-utilisateurs
 */
function initGuestbook() {
  const toggle = document.getElementById('guestbook-toggle');
  const drawer = document.getElementById('guestbook-drawer');
  const closeBtn = document.getElementById('drawer-close');
  const form = document.getElementById('guestbook-form');
  const textarea = document.getElementById('gb-message');
  const charCount = document.getElementById('gb-char-count');
  
  if (!toggle || !drawer) return;
  
  // Initialise Firebase si pas déjà fait
  if (!guestbookDatabase && window.firebaseApp) {
    const { initializeApp, getDatabase, ref, onChildAdded } = window.firebaseApp;
    const app = initializeApp(firebaseConfig);
    guestbookDatabase = getDatabase(app);
    guestbookMessagesRef = ref(guestbookDatabase, 'messages');
    
    // Écoute les nouveaux messages en temps réel
    onChildAdded(guestbookMessagesRef, (snapshot) => {
      const message = snapshot.val();
      if (message) {
        addGuestbookEntryToUI(message);
      }
    });
  }
  
  // Crée l'overlay sombre
  const overlay = document.createElement('div');
  overlay.className = 'drawer-overlay';
  document.body.appendChild(overlay);
  
  // Ouverture du drawer
  toggle.addEventListener('click', () => {
    drawer.classList.add('drawer-open');
    overlay.classList.add('visible');
    document.body.style.overflow = 'hidden';
    // Note: Les messages sont gérés uniquement par onChildAdded en temps réel
    // Pas de boucle manuelle pour éviter les doublons
  });
  
  // Fermeture via le bouton X
  closeBtn.addEventListener('click', closeDrawer);
  
  // Fermeture via l'overlay (clic en dehors)
  overlay.addEventListener('click', closeDrawer);
  
  // Fermeture avec la touche Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer.classList.contains('drawer-open')) {
      closeDrawer();
    }
  });
  
  function closeDrawer() {
    drawer.classList.remove('drawer-open');
    overlay.classList.remove('visible');
    document.body.style.overflow = '';
    // Met à jour le badge quand on ferme le drawer
    updateMessageBadge();
  }
  
  // Compteur de caractères
  if (textarea && charCount) {
    textarea.addEventListener('input', () => {
      const count = textarea.value.length;
      charCount.textContent = `${count}/280`;
    });
  }
  
  // Soumission du formulaire vers Firebase
  if (form) {
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn ? submitBtn.innerHTML : 'Signer ✍️';
    
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const name = document.getElementById('gb-name').value.trim();
      const message = document.getElementById('gb-message').value.trim();
      
      if (!name || !message) return;
      
      // Vérifie que Firebase est prêt
      if (!guestbookDatabase || !window.firebaseApp) {
        showToast('Connexion impossible... Réessaie !');
        return;
      }
      
      // Animation du bouton pendant l'envoi
      if (submitBtn) {
        submitBtn.innerHTML = 'Envoi...';
        submitBtn.disabled = true;
      }
      
      // Crée l'entrée
      const entry = {
        name: name,
        message: message,
        timestamp: Date.now(),
        date: new Date().toLocaleString('fr-FR', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit'
        })
      };
      
      // Envoie à Firebase Realtime Database
      const { push } = window.firebaseApp;
      push(guestbookMessagesRef, entry)
        .then(() => {
          // Reset formulaire
          form.reset();
          if (charCount) charCount.textContent = '0/280';
          
          // Animation de succès sur le bouton
          if (submitBtn) {
            submitBtn.innerHTML = 'Envoyé ✓';
            submitBtn.style.background = 'rgba(81, 207, 102, 0.3)';
            submitBtn.style.borderColor = 'rgba(81, 207, 102, 0.5)';
            
            setTimeout(() => {
              submitBtn.innerHTML = originalBtnText;
              submitBtn.style.background = '';
              submitBtn.style.borderColor = '';
              submitBtn.disabled = false;
            }, 2000);
          }
          
          showToast('Message envoyé ! ✨');
        })
        .catch((error) => {
          console.error('Erreur envoi message:', error);
          showToast('Erreur... Réessaie !');
          if (submitBtn) {
            submitBtn.innerHTML = originalBtnText;
            submitBtn.disabled = false;
          }
        });
    });
  }
}

/**
 * Ajoute un message à l'interface (appelé par onChildAdded)
 * Affiche uniquement les messages valides, ordre chronologique (anciens en haut)
 */
function addGuestbookEntryToUI(entry) {
  // Sécurité : ignore les messages vides ou invalides
  if (!entry || !entry.name || !entry.message || !entry.name.trim() || !entry.message.trim()) {
    return;
  }
  
  // Vérifie si déjà présent (évite les doublons via timestamp + nom)
  if (guestbookEntries.some(e => e.timestamp === entry.timestamp && e.name === entry.name)) {
    return;
  }
  
  // Ajoute en fin de liste pour ordre chronologique (anciens en haut, nouveaux en bas)
  guestbookEntries.push(entry);
  
  // Incrémente le compteur de messages
  messageCount++;
  updateMessageBadge();
  
  const list = document.getElementById('guestbook-list');
  if (!list) return;
  
  // Supprime le message "Aucun message" si présent
  const emptyMsg = list.querySelector('.guestbook-empty');
  if (emptyMsg) {
    emptyMsg.remove();
  }
  
  // Crée l'élément avec animation
  const entryDiv = document.createElement('div');
  entryDiv.className = 'guestbook-entry';
  entryDiv.style.animation = 'slideIn 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
  entryDiv.innerHTML = `
    <div class="entry-header">
      <span class="entry-name">${escapeHtml(entry.name)}</span>
      <span class="entry-time">${entry.date}</span>
    </div>
    <div class="entry-message">${escapeHtml(entry.message)}</div>
  `;
  
  // Ajoute à la fin (ordre chronologique : anciens en haut, nouveaux en bas)
  list.appendChild(entryDiv);
  
  // Auto-scroll vers le bas pour voir le nouveau message
  const drawerContent = document.querySelector('.drawer-content');
  if (drawerContent) {
    drawerContent.scrollTo({
      top: drawerContent.scrollHeight,
      behavior: 'smooth'
    });
  }
}

/**
 * Met à jour la pastille de notification sur le bouton
 * Affiche le nombre de messages et anime le changement
 * Se cache automatiquement si le drawer est ouvert
 */
function updateMessageBadge() {
  const badge = document.getElementById('message-count');
  const drawer = document.getElementById('guestbook-drawer');
  if (!badge) return;
  
  // Si le drawer est ouvert, on cache le badge
  if (drawer && drawer.classList.contains('drawer-open')) {
    badge.classList.remove('visible');
    return;
  }
  
  // Affiche le badge seulement s'il y a des messages
  if (messageCount > 0) {
    badge.textContent = messageCount > 99 ? '99+' : messageCount;
    badge.classList.add('visible');
    
    // Animation pop quand le chiffre change
    badge.classList.add('pop');
    setTimeout(() => {
      badge.classList.remove('pop');
    }, 300);
  } else {
    badge.classList.remove('visible');
  }
}

/**
 * Affiche l'état vide du Livre d'Or si aucun message
 * Note : Les messages sont ajoutés un par un via onChildAdded en temps réel
 */
function renderGuestbookEntries() {
  const list = document.getElementById('guestbook-list');
  if (!list) return;
  
  // Affiche uniquement le message vide si la liste est vide
  // Les messages réels sont gérés par addGuestbookEntryToUI appelé par onChildAdded
  if (guestbookEntries.length === 0) {
    list.innerHTML = `
      <div class="guestbook-empty">
        Aucun message encore...<br>
        Sois le premier à signer ! ✍️
      </div>
    `;
  }
}

/* ── LANCEMENT ───────────────────────────────────────────── */

init();