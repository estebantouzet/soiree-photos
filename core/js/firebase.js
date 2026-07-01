import { state } from './state.js';
import { getUserFingerprint, escapeHtml, showToast } from './utils.js';

let db = null;
let reactionsUnsub = null;
let tagsUnsub     = null;
export let tagMode = false;
let pendingBubble  = null;

const EMOJIS = ['❤️','🔥','😂','🙈','😮','🐆','💩'];

// ── Init Firebase DB ───────────────────────────────────────

function getDb() {
  if (db) return db;
  const cfg = state.eventConfig?.firebase;
  if (!cfg?.databaseURL || !window.firebaseApp) return null;
  const { initializeApp, getApps, getDatabase } = window.firebaseApp;
  const app = getApps().length ? getApps()[0] : initializeApp(cfg);
  db = getDatabase(app);
  return db;
}

// ── Guestbook ──────────────────────────────────────────────

export function initGuestbook() {
  const toggle  = document.getElementById('guestbook-toggle');
  const drawer  = document.getElementById('guestbook-drawer');
  const closeBtn= document.getElementById('drawer-close');
  const form    = document.getElementById('guestbook-form');
  const textarea= document.getElementById('gb-message');
  const charCnt = document.getElementById('gb-char-count');
  if (!toggle || !drawer) return;

  const database = getDb();
  if (database) {
    const { ref, onChildAdded } = window.firebaseApp;
    const messagesRef = ref(database, `messages/${state.eventSlug}`);
    onChildAdded(messagesRef, snap => {
      const msg = snap.val();
      if (msg) addGuestbookEntryToUI(msg);
    });
  }

  const overlay = document.createElement('div');
  overlay.className = 'drawer-overlay';
  document.body.appendChild(overlay);

  const openDrawer  = () => { drawer.classList.add('drawer-open'); overlay.classList.add('visible'); document.body.style.overflow = 'hidden'; };
  const closeDrawer = () => { drawer.classList.remove('drawer-open'); overlay.classList.remove('visible'); document.body.style.overflow = ''; updateMessageBadge(); };

  toggle.addEventListener('click', openDrawer);
  closeBtn?.addEventListener('click', closeDrawer);
  overlay.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && drawer.classList.contains('drawer-open')) closeDrawer(); });

  if (textarea && charCnt) {
    textarea.addEventListener('input', () => { charCnt.textContent = `${textarea.value.length}/280`; });
  }

  form?.addEventListener('submit', async e => {
    e.preventDefault();
    const database = getDb();
    if (!database) { showToast('Firebase non configuré pour cette soirée'); return; }
    const { ref, push } = window.firebaseApp;
    const name = document.getElementById('gb-name')?.value.trim();
    const msg  = textarea?.value.trim();
    if (!name || !msg) return;
    const entry = { name: escapeHtml(name), message: escapeHtml(msg), date: new Date().toISOString(), fingerprint: getUserFingerprint() };
    try {
      await push(ref(database, `messages/${state.eventSlug}`), entry);
      form.reset();
      if (charCnt) charCnt.textContent = '0/280';
    } catch { showToast('Erreur lors de l\'envoi'); }
  });
}

let messageCount = 0;

function addGuestbookEntryToUI(entry) {
  const list = document.getElementById('guestbook-list');
  if (!list) return;
  const div = document.createElement('div');
  div.className = 'guestbook-entry';
  const date = entry.date ? new Date(entry.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
  div.innerHTML = `<div class="gb-entry-header"><strong class="gb-name">${entry.name}</strong><span class="gb-date">${date}</span></div>
    <p class="gb-text">${entry.message}</p>`;
  list.prepend(div);
  messageCount++;
  updateMessageBadge();
}

function updateMessageBadge() {
  const badge = document.getElementById('message-count');
  if (!badge) return;
  badge.textContent = messageCount > 0 ? messageCount : '';
  badge.style.display = messageCount > 0 ? 'inline-flex' : 'none';
}

// ── Réactions ──────────────────────────────────────────────

export function loadReactionsForPhoto(photoId) {
  if (photoId === null) return;
  const database = getDb();
  if (!database) { resetReactionCounts(); return; }
  const { ref, onValue } = window.firebaseApp;
  if (reactionsUnsub) { reactionsUnsub(); reactionsUnsub = null; }
  const photoRef = ref(database, `reactions/${state.eventSlug}/${photoId}`);
  reactionsUnsub = onValue(photoRef, snap => {
    const data = snap.val() || {};
    const userReacted = getUserReactions(photoId);
    EMOJIS.forEach(emoji => {
      const safe  = emojiKey(emoji);
      const total = data[safe] ? Object.keys(data[safe]).length : 0;
      const countEl = document.getElementById(`rc-${emoji}`);
      const btn  = document.querySelector(`.reaction-btn[data-emoji="${emoji}"]`);
      if (countEl) countEl.textContent = total > 0 ? total : '0';
      if (btn) btn.classList.toggle('reacted', userReacted.includes(emoji));
    });
  });
}

function resetReactionCounts() {
  EMOJIS.forEach(emoji => {
    const el = document.getElementById(`rc-${emoji}`);
    if (el) el.textContent = '0';
    document.querySelector(`.reaction-btn[data-emoji="${emoji}"]`)?.classList.remove('reacted');
  });
}

export function toggleReaction(emoji) {
  const { lightboxIdx, eventSlug } = state;
  if (lightboxIdx === null) return;
  const database = getDb();
  if (!database) return;
  const { ref, set, remove } = window.firebaseApp;
  const fp  = getUserFingerprint();
  const safe = emojiKey(emoji);
  const nodeRef = ref(database, `reactions/${eventSlug}/${lightboxIdx}/${safe}/${fp}`);
  const userReacted = getUserReactions(lightboxIdx);
  const hasReacted  = userReacted.includes(emoji);

  const btn = document.querySelector(`.reaction-btn[data-emoji="${emoji}"]`);
  if (btn) {
    btn.classList.toggle('reacted', !hasReacted);
    btn.classList.add('pop');
    btn.addEventListener('animationend', () => btn.classList.remove('pop'), { once: true });
  }

  if (hasReacted) {
    localStorage.setItem(`react_${eventSlug}_${lightboxIdx}`, JSON.stringify(userReacted.filter(e => e !== emoji)));
    remove(nodeRef);
  } else {
    localStorage.setItem(`react_${eventSlug}_${lightboxIdx}`, JSON.stringify([...userReacted, emoji]));
    set(nodeRef, true);
  }
}

function getUserReactions(photoId) {
  try { return JSON.parse(localStorage.getItem(`react_${state.eventSlug}_${photoId}`) || '[]'); } catch { return []; }
}

function emojiKey(emoji) {
  return [...emoji].map(c => c.codePointAt(0).toString(16)).join('_');
}

// ── Tags ───────────────────────────────────────────────────

export function toggleTagMode() {
  tagMode = !tagMode;
  window.tagMode = tagMode;
  document.getElementById('lightbox')?.classList.toggle('tag-mode', tagMode);
  document.getElementById('lbTagBtn')?.classList.toggle('active', tagMode);
  dismissTagBubble();
}

export function loadTagsForPhoto(photoId) {
  if (photoId === null) return;
  const overlay = document.getElementById('lbTagsOverlay');
  if (overlay) overlay.innerHTML = '';
  const database = getDb();
  if (!database) return;
  const { ref, onValue } = window.firebaseApp;
  if (tagsUnsub) { tagsUnsub(); tagsUnsub = null; }
  tagsUnsub = onValue(ref(database, `tags/${state.eventSlug}/${photoId}`), snap => {
    const overlay = document.getElementById('lbTagsOverlay');
    if (!overlay) return;
    overlay.innerHTML = '';
    const data = snap.val() || {};
    Object.entries(data).forEach(([key, tag]) => renderTagDot(overlay, key, tag));
  });
}

function renderTagDot(overlay, key, tag) {
  const dot = document.createElement('div');
  dot.className = 'tag-dot';
  dot.style.left = (tag.x * 100) + '%';
  dot.style.top  = (tag.y * 100) + '%';
  dot.innerHTML = `<div class="tag-dot-circle">${(tag.name || '?')[0].toUpperCase()}</div>
    <div class="tag-dot-label">${escapeHtml(tag.name || '')}</div>
    <button class="tag-dot-remove" onclick="removeTag('${key}')" title="Supprimer">✕</button>`;
  overlay.appendChild(dot);
}

export function removeTag(key) {
  const database = getDb();
  if (!database || state.lightboxIdx === null) return;
  const { ref, remove } = window.firebaseApp;
  remove(ref(database, `tags/${state.eventSlug}/${state.lightboxIdx}/${key}`));
}

export function handleTagClick(e) {
  if (!tagMode) return;
  const wrapper = document.getElementById('lbImgWrapper');
  if (!wrapper || e.target.closest('.tag-dot')) return;
  const rect = wrapper.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width;
  const y = (e.clientY - rect.top)  / rect.height;
  dismissTagBubble();
  showTagBubble(x, y, wrapper);
}

function showTagBubble(x, y, wrapper) {
  const bubble = document.createElement('div');
  bubble.className = 'tag-input-bubble';
  bubble.style.left = (x * 100) + '%';
  bubble.style.top  = (y * 100) + '%';
  bubble.innerHTML = `<input type="text" placeholder="Prénom…" maxlength="20" autofocus>
    <button class="tag-input-confirm">✓</button>
    <button class="tag-input-cancel">✕</button>`;
  wrapper.appendChild(bubble);
  pendingBubble = bubble;
  const input = bubble.querySelector('input');
  input.focus();
  const confirm = () => { const n = input.value.trim(); if (n) saveTag(x, y, n); dismissTagBubble(); };
  bubble.querySelector('.tag-input-confirm').addEventListener('click', confirm);
  bubble.querySelector('.tag-input-cancel').addEventListener('click', dismissTagBubble);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') confirm(); if (e.key === 'Escape') dismissTagBubble(); e.stopPropagation(); });
}

export function dismissTagBubble() {
  if (pendingBubble) { pendingBubble.remove(); pendingBubble = null; }
}

function saveTag(x, y, name) {
  const database = getDb();
  if (!database || state.lightboxIdx === null) return;
  const { ref, push, set } = window.firebaseApp;
  const newRef = push(ref(database, `tags/${state.eventSlug}/${state.lightboxIdx}`));
  set(newRef, { x, y, name, by: getUserFingerprint(), ts: Date.now() });
}
