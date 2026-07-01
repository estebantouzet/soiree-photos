import { state } from './state.js';
import { haptic } from './utils.js';

let pinEntered = '';

export function initPasswordScreen() {
  const screen = document.getElementById('password-screen');
  if (!screen) return;

  const { eventConfig, eventSlug } = state;
  const pin = eventConfig.pin || '1234';

  if (sessionStorage.getItem(`auth_${eventSlug}`) === '1') {
    screen.classList.add('hidden');
    return;
  }

  // Met à jour le titre avec le nom de la soirée
  const titleEl = document.getElementById('pwTitle');
  if (titleEl) titleEl.textContent = eventConfig.title || 'Soirée privée';

  document.querySelectorAll('.pw-key[data-k]').forEach(btn => {
    btn.addEventListener('click', () => { haptic(8); pinDigit(btn.dataset.k, pin, eventSlug); });
  });
  document.getElementById('pwDel')?.addEventListener('click', () => { haptic(6); pinDelete(); });

  document.addEventListener('keydown', e => {
    if (document.getElementById('password-screen')?.classList.contains('hidden')) return;
    if (/^\d$/.test(e.key)) pinDigit(e.key, pin, eventSlug);
    if (e.key === 'Backspace') pinDelete();
  });
}

function pinDigit(d, pin, slug) {
  if (pinEntered.length >= 4) return;
  pinEntered += d;
  updatePinDots();
  if (pinEntered.length === 4) setTimeout(() => checkPin(pin, slug), 120);
}

function pinDelete() {
  pinEntered = pinEntered.slice(0, -1);
  updatePinDots();
  const err = document.getElementById('pwError');
  if (err) { err.textContent = ''; err.classList.remove('visible'); }
}

function updatePinDots() {
  document.querySelectorAll('.pw-dot').forEach((dot, i) => {
    dot.classList.toggle('filled', i < pinEntered.length);
    dot.classList.remove('error');
  });
}

function checkPin(pin, slug) {
  const dotsEl = document.getElementById('pwDots');
  const err    = document.getElementById('pwError');

  if (pinEntered === pin) {
    sessionStorage.setItem(`auth_${slug}`, '1');
    haptic(20);
    document.querySelectorAll('.pw-dot').forEach(d => d.classList.add('filled'));
    setTimeout(() => document.getElementById('password-screen')?.classList.add('hidden'), 250);
  } else {
    haptic([50, 100, 50]);
    document.querySelectorAll('.pw-dot').forEach(d => { d.classList.add('error'); d.classList.remove('filled'); });
    dotsEl?.classList.add('shake');
    if (err) { err.textContent = 'Code incorrect, réessaie ✌️'; err.classList.add('visible'); }
    setTimeout(() => dotsEl?.classList.remove('shake'), 500);
    pinEntered = '';
    setTimeout(updatePinDots, 500);
  }
}
