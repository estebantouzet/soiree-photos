/**
 * main.js — Point d'entrée de l'app publique
 * Charge la config de l'événement depuis l'API Flask,
 * initialise tous les modules, puis expose les fonctions
 * globales nécessaires aux onclick HTML.
 */

import { state }                    from './state.js';
import { showToast }                from './utils.js';
import { initPasswordScreen }       from './password.js';
import { initWelcomeScreen, initAfterPhotosLoaded, preloadAll, enterGallery, closeWelcomeScreen } from './welcome.js';
import { render, getFiltered, setFilter, toggleSort, toggleGrid, applyGrid, toggleFav,
         downloadAll, downloadFavorites, updateSubtitle, updateFilterContext,
         buildHourFilters, buildStoriesBar, showShortcutsHelp, animateCounter,
         initHeaderMenu, closeHeaderMenu, updateFooterBg, formatSectionLabel }  from './grid.js';
import { openLightbox, closeLightbox, prevPhoto, nextPhoto, handleLightboxClick,
         toggleLightboxFav, updateLbFavBtn, downloadSingle, launchSlideshow,
         startSlideshow, stopSlideshow, toggleSlideshowPause, setSlideshowSpeed,
         initLightboxSwipe }        from './lightbox.js';
import { initStory, openGlobalStory, openFilteredStory, closeStory } from './story.js';
import { initFilmStrip, openFilmStrip, closeFilmStrip, filmStripPrev, filmStripNext, onFilmImageLoad } from './film-strip.js';
import { initGuestbook, loadReactionsForPhoto, loadTagsForPhoto, toggleReaction,
         toggleTagMode, handleTagClick, removeTag, dismissTagBubble } from './firebase.js';
import { shareSinglePhoto, shareSite, openUploadModal, closeUploadModal, submitUpload } from './share.js';

// ── 1. Charge la config de l'événement ────────────────────

async function loadEventConfig() {
  const slug = window.EVENT_SLUG;
  if (!slug) throw new Error('EVENT_SLUG non défini');
  const resp = await fetch(`/api/events/${slug}`);
  if (!resp.ok) throw new Error(`Config introuvable pour ${slug}`);
  return resp.json();
}

// ── 2. Init globale ────────────────────────────────────────

async function init() {
  // Charge la config
  try {
    const config = await loadEventConfig();
    state.eventConfig = config;
  } catch (e) {
    console.warn('Config non chargée, mode dégradé :', e.message);
    state.eventConfig = { title: 'Album soirée', pin: '1234' };
  }

  // Met à jour les meta tags
  const { eventConfig } = state;
  document.title = eventConfig.title || 'Album soirée';
  const ogTitle = document.getElementById('ogTitle');
  if (ogTitle) ogTitle.content = eventConfig.title || '';
  const metaTitle = document.getElementById('metaAppTitle');
  if (metaTitle) metaTitle.content = eventConfig.title || 'Album soirée';
  const appTitle = document.getElementById('appTitle');
  if (appTitle) appTitle.textContent = eventConfig.title || 'Album soirée';

  // Écran mot de passe
  initPasswordScreen();

  // Splash screen
  initWelcomeScreen();

  // Scroll-to-top
  const scrollBtn = document.createElement('button');
  scrollBtn.className = 'scroll-top';
  scrollBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M18 15l-6-6-6 6"/></svg>`;
  scrollBtn.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  document.body.appendChild(scrollBtn);

  window.addEventListener('scroll', () => {
    const header = document.querySelector('.header');
    header?.classList.toggle('scrolled', window.scrollY > 10);
    scrollBtn.classList.toggle('visible', window.scrollY > 400);
  });

  // Charge les photos
  try {
    const res = await fetch(`/api/events/${state.eventSlug}/photos.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const photos = await res.json();
    state.photos = photos;

    // Restaure les favoris (namespaced par slug)
    const savedFavs = JSON.parse(localStorage.getItem(`favs_${state.eventSlug}`) || '[]');
    state.photos.forEach(p => { p.fav = savedFavs.includes(p.src); });

    // Preloader + animations welcome screen
    await preloadAll();
    initAfterPhotosLoaded();

    // Grille
    state.gridColumns = parseInt(localStorage.getItem('gridColumns') || '3');
    applyGrid();
    buildHourFilters();
    render();
    updateSubtitle();
    buildStoriesBar();

    // Modules
    initGuestbook();
    initStory();
    initFilmStrip();
    initHeaderMenu();
    updateFooterBg();
    initLightboxSwipe();

    // Navigation clavier
    document.addEventListener('keydown', onKeyDown);

  } catch (err) {
    document.getElementById('photoGrid').innerHTML = `
      <div class="empty" style="grid-column:1/-1">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <strong>Impossible de charger les photos</strong>
        <span>Lance d'abord la génération depuis le panel admin</span>
      </div>`;
  }
}

function onKeyDown(e) {
  const lb   = document.getElementById('lightbox')?.classList.contains('open');
  const story= !document.getElementById('story-overlay')?.classList.contains('hidden');
  if (lb) {
    if (e.key === 'ArrowLeft')  { e.preventDefault(); prevPhoto(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); nextPhoto(); }
    if (e.key === 'Escape')     closeLightbox();
    if (e.key === 'f' || e.key === 'F') toggleLightboxFav();
    if (e.key === ' ')          { e.preventDefault(); toggleSlideshowPause(); }
  }
  if (story && e.key === 'Escape') closeStory();
}

// ── 3. Expose les fonctions globales (onclick HTML) ────────

Object.assign(window, {
  // Grid
  setFilter, toggleSort, toggleGrid, toggleFav, downloadAll, downloadFavorites,
  showShortcutsHelp, closeHeaderMenu,
  // Lightbox
  openLightbox, closeLightbox, prevPhoto, nextPhoto, handleLightboxClick,
  toggleLightboxFav, updateLbFavBtn, downloadSingle,
  launchSlideshow, toggleSlideshowPause, setSlideshowSpeed,
  // Welcome
  enterGallery, closeWelcomeScreen,
  // Story
  openGlobalStory, openFilteredStory, closeStory,
  // Film strip
  openFilmStrip, closeFilmStrip, filmStripPrev, filmStripNext, onFilmImageLoad,
  // Firebase
  loadReactionsForPhoto, loadTagsForPhoto, toggleReaction,
  toggleTagMode, handleTagClick, removeTag, dismissTagBubble,
  // Share
  shareSinglePhoto, shareSite, openUploadModal, closeUploadModal, submitUpload,
  // Lightbox tag click handler
  handleLightboxTagClick: handleTagClick,
});

// ── Branche click tag sur lightbox ────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('lightbox')?.addEventListener('click', e => {
    if (window.tagMode && e.target.closest('#lbImgWrapper')) handleTagClick(e);
  });
});

// ── Lance ──────────────────────────────────────────────────

init();
