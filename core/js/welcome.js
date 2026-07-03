import { state } from './state.js';
import { haptic, showToast } from './utils.js';
import { animateCounter, buildStoriesBar } from './grid.js';

let gyroscopeActive = false;
let previewInterval = null;

export function initWelcomeScreen() {
  const screen = document.getElementById('welcome-screen');
  if (!screen) return;
  document.body.classList.add('splash-open');

  const pc = document.querySelector('.preview-container');
  if (pc) {
    pc.ontouchstart = () => { haptic(15); pc.classList.add('active'); };
    pc.ontouchend   = () => pc.classList.remove('active');
  }

  // Brancher le bouton Story du splash
  document.getElementById('story-open')?.addEventListener('click', handleDirectStory);
}

export function initAfterPhotosLoaded() {
  const { photos, eventConfig } = state;

  // Mise à jour titre splash
  const welcomeTitle = document.getElementById('welcomeTitle');
  if (welcomeTitle && eventConfig.title) {
    const words = eventConfig.title.split(' ');
    welcomeTitle.innerHTML = words.map((w, i) =>
      `<span class="word-reveal" style="--delay:${i * 0.15}s">${w}</span>`
    ).join(' ');
  }

  // Date
  const dateEl = document.getElementById('event-date');
  if (dateEl) {
    if (eventConfig.date) {
      dateEl.textContent = eventConfig.date;
    } else if (photos.length > 0 && photos[0].date) {
      const d = new Date(photos[0].date);
      dateEl.textContent = d.toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric' }).replace(/\//g, '.');
    }
  }

  // OG image dynamique
  const ogImg = document.getElementById('ogImage');
  if (ogImg && photos.length > 0) ogImg.content = photos[0].src;

  initHomePreview();
  initWelcomeCanvas();
  initGyroscopeParallax();
}

function initHomePreview() {
  const img = document.getElementById('preview-img');
  const { photos } = state;
  if (!img || !photos.length) return;
  let idx = 0;
  img.src = photos[0].thumb || photos[0].src;
  previewInterval = setInterval(() => {
    idx = (idx + 1) % photos.length;
    img.src = photos[idx].thumb || photos[idx].src;
  }, 100);
}

function initWelcomeCanvas() {
  const canvas = document.getElementById('welcomeCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.fillStyle = '#080808';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  resize();
  window.addEventListener('resize', resize);
}

function initGyroscopeParallax() {
  const bg = document.getElementById('welcome-bg');
  if (!bg) return;
  const { photos } = state;
  if (photos.length > 0) {
    // fond géré par le canvas bokeh — on garde juste le parallaxe gyroscope
    bg.style.backgroundImage = 'none';
  }
  if (/iPad|iPhone|iPod/.test(navigator.userAgent) && typeof DeviceOrientationEvent?.requestPermission === 'function') {
    document.querySelector('.welcome-btn')?.addEventListener('click', async () => {
      try { if (await DeviceOrientationEvent.requestPermission() === 'granted') startGyroscopeTracking(bg); } catch {}
    }, { once: true });
  } else {
    startGyroscopeTracking(bg);
  }
}

function startGyroscopeTracking(bg) {
  if (gyroscopeActive) return;
  gyroscopeActive = true;
  let lastB = 0, lastG = 0, rafId = null;
  const handler = e => {
    const nb = Math.max(-45, Math.min(45, e.beta || 0));
    const ng = Math.max(-45, Math.min(45, e.gamma || 0));
    lastB += ((nb / 45) * 20 - lastB) * 0.1;
    lastG += ((ng / 45) * 20 - lastG) * 0.1;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => { bg.style.transform = `scale(1.1) translate3d(${-lastG}px,${-lastB}px,0)`; });
  };
  window.addEventListener('deviceorientation', handler, { passive: true });
  const obs = new MutationObserver(muts => {
    muts.forEach(m => {
      if (m.target.classList.contains('hidden')) {
        window.removeEventListener('deviceorientation', handler);
        if (rafId) cancelAnimationFrame(rafId);
        gyroscopeActive = false;
        obs.disconnect();
      }
    });
  });
  obs.observe(document.getElementById('welcome-screen'), { attributes: true, attributeFilter: ['class'] });
}

// ── Navigation splash ──────────────────────────────────────

export function enterGallery() {
  if (previewInterval) { clearInterval(previewInterval); previewInterval = null; }
  showStoryPrompt();
}

function handleDirectStory() {
  if (previewInterval) { clearInterval(previewInterval); previewInterval = null; }
  closeWelcomeScreen();
  setTimeout(() => {
    window.openGlobalStory?.();
  }, 300);
}

function showStoryPrompt() {
  const modal = document.getElementById('story-prompt-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  document.getElementById('prompt-story-btn').onclick = () => {
    closeStoryPrompt(); closeWelcomeScreen();
    setTimeout(() => window.openGlobalStory?.(), 300);
  };
  document.getElementById('prompt-album-btn').onclick = () => {
    closeStoryPrompt(); closeWelcomeScreen();
  };
}

function closeStoryPrompt() {
  document.getElementById('story-prompt-modal')?.classList.add('hidden');
}

export function closeWelcomeScreen() {
  const screen = document.getElementById('welcome-screen');
  if (!screen) return;
  screen.classList.add('cinematic-exit');
  document.body.classList.remove('splash-open');
  setTimeout(() => {
    screen.classList.add('hidden');
    screen.classList.remove('cinematic-exit');
  }, 750);
}

// ── Preloader ──────────────────────────────────────────────

export async function preloadAll() {
  const { photos } = state;
  const loadPerc   = document.getElementById('load-perc');
  const loadStatus = document.getElementById('load-status');
  const preloader  = document.getElementById('preloader');
  if (!photos.length || !preloader) return;

  let loaded = 0;
  const msgs = ['Préparation du flash…', 'Flash activé…', 'Mise au point…', 'Développement…'];

  await Promise.all(photos.map(p => new Promise(res => {
    const img = new Image();
    img.onload = img.onerror = () => {
      loaded++;
      const pct = Math.round(loaded / photos.length * 100);
      if (loadPerc) loadPerc.textContent = `${pct}%`;
      if (loadStatus) loadStatus.textContent = msgs[Math.min(Math.floor(pct / 25), 3)];
      if (loaded === photos.length) {
        setTimeout(() => {
          preloader.classList.add('hidden');
          document.getElementById('welcome-screen')?.classList.add('start-anim');
          setTimeout(() => animateCounter(photos.length, 'total-moments', 2000), 300);
        }, 500);
      }
      res();
    };
    img.src = p.thumb || p.src;
  })));
}
