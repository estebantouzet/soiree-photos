/* =============================================
   Admin Panel — Photo Soirée
   Communique avec Flask via /api/events/*
   ============================================= */

let currentSlug = null;
let uploadQueue  = [];
let toastTimer   = null;
let confirmCallback = null;

// ── Navigation ─────────────────────────────────────────────

function showSection(id) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`section-${id}`)?.classList.add('active');
  const btn = document.querySelector(`.nav-btn[data-section="${id}"]`);
  if (btn) btn.classList.add('active');
}

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => showSection(btn.dataset.section));
});

document.getElementById('btnBackEvents')?.addEventListener('click', () => showSection('events'));
document.getElementById('btnRefresh')?.addEventListener('click', loadEvents);

// ── Toast ───────────────────────────────────────────────────

function toast(msg, duration = 3000) {
  const el = document.getElementById('adminToast');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), duration);
}

// ── Confirm modal ───────────────────────────────────────────

function confirm(title, text, cb) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmText').textContent  = text;
  document.getElementById('confirmModal').classList.remove('hidden');
  confirmCallback = cb;
}
document.getElementById('confirmCancel')?.addEventListener('click', () => {
  document.getElementById('confirmModal').classList.add('hidden');
  confirmCallback = null;
});
document.getElementById('confirmOk')?.addEventListener('click', () => {
  document.getElementById('confirmModal').classList.add('hidden');
  confirmCallback?.();
  confirmCallback = null;
});

// ── Chargement des soirées ──────────────────────────────────

async function loadEvents() {
  const grid = document.getElementById('eventsGrid');
  grid.innerHTML = '<div class="loading-card">Chargement…</div>';
  try {
    const res    = await fetch('/api/events');
    const events = await res.json();
    const cntEl  = document.getElementById('eventCount');
    cntEl.textContent = `${events.length} soirée${events.length !== 1 ? 's' : ''}`;

    if (!events.length) {
      grid.innerHTML = `<div class="empty-state">
        Aucune soirée — <button class="btn btn-primary btn-sm" onclick="showSection('new')">Créer la première →</button>
      </div>`;
      return;
    }

    grid.innerHTML = events.map(e => `
      <div class="event-card" onclick="openEvent('${e.slug}')">
        <div class="event-card-icon">🎉</div>
        <div class="event-card-title">${e.title || e.slug}</div>
        <div class="event-card-slug">/events/${e.slug}/</div>
        <div class="event-card-meta">
          ${e.date ? `<span class="event-card-pill">${e.date}</span>` : ''}
          <span class="event-card-pill ${e.photoCount > 0 ? 'ok' : ''}">${e.photoCount || 0} photo${e.photoCount !== 1 ? 's' : ''}</span>
        </div>
      </div>`).join('');
  } catch {
    grid.innerHTML = '<div class="loading-card" style="color:#ef4444">Erreur de connexion au serveur Flask. Assure-toi que <code>python server.py</code> est lancé.</div>';
  }
}

// ── Ouvrir le détail d'une soirée ──────────────────────────

async function openEvent(slug) {
  currentSlug = slug;
  showSection('detail');
  try {
    const config = await (await fetch(`/api/events/${slug}`)).json();
    document.getElementById('detailTitle').textContent = config.title || slug;
    const link = document.getElementById('detailViewLink');
    link.href = `/events/${slug}/`;

    // Remplit le form
    document.getElementById('editTitle').value       = config.title       || '';
    document.getElementById('editSubtitle').value    = config.subtitle    || '';
    document.getElementById('editDate').value        = config.date        || '';
    document.getElementById('editPin').value         = config.pin         || '';
    document.getElementById('editFirebaseUrl').value = config.firebase?.databaseURL || '';
    document.getElementById('editFirebaseKey').value = config.firebase?.apiKey      || '';
    document.getElementById('editFirebaseProject').value = config.firebase?.projectId || '';

    document.getElementById('photoCountEl').textContent = config.photoCount || 0;
    loadPhotoPreview(slug);
  } catch {
    toast('Erreur lors du chargement de la soirée');
  }
}
window.openEvent = openEvent;

// ── Sauvegarde config ───────────────────────────────────────

document.getElementById('editForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const msg = document.getElementById('editMsg');
  msg.className = 'form-msg';
  const firebase = {
    databaseURL: document.getElementById('editFirebaseUrl').value.trim(),
    apiKey:      document.getElementById('editFirebaseKey').value.trim(),
    projectId:   document.getElementById('editFirebaseProject').value.trim(),
  };
  const data = {
    title:    document.getElementById('editTitle').value.trim(),
    subtitle: document.getElementById('editSubtitle').value.trim(),
    date:     document.getElementById('editDate').value,
    pin:      document.getElementById('editPin').value.trim(),
    firebase,
  };
  try {
    const res = await fetch(`/api/events/${currentSlug}/config`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const cfg = await res.json();
    document.getElementById('detailTitle').textContent = cfg.title || currentSlug;
    msg.textContent = '✓ Sauvegardé';
    msg.className = 'form-msg ok';
    toast('Config sauvegardée ✓');
    setTimeout(() => { msg.textContent = ''; }, 3000);
  } catch {
    msg.textContent = 'Erreur lors de la sauvegarde';
    msg.className = 'form-msg err';
  }
});

// ── Suppression soirée ──────────────────────────────────────

document.getElementById('btnDeleteEvent')?.addEventListener('click', () => {
  confirm('Supprimer la soirée', `Supprimer "${currentSlug}" et toutes ses photos ? Cette action est irréversible.`, async () => {
    try {
      await fetch(`/api/events/${currentSlug}`, { method: 'DELETE' });
      toast(`Soirée "${currentSlug}" supprimée`);
      currentSlug = null;
      showSection('events');
      loadEvents();
    } catch {
      toast('Erreur lors de la suppression');
    }
  });
});

// ── Création soirée ─────────────────────────────────────────

document.getElementById('newTitle')?.addEventListener('input', e => {
  const slug = e.target.value.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '').trim()
    .replace(/\s+/g, '-').slice(0, 40);
  document.getElementById('newSlug').value = slug;
});

document.getElementById('newFirebaseUrl')?.addEventListener('input', e => {
  const fields = document.getElementById('firebaseFields');
  if (fields) fields.style.display = e.target.value.trim() ? 'flex' : 'none';
  if (fields) fields.style.flexDirection = 'column';
});

document.getElementById('createForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const msg = document.getElementById('createMsg');
  msg.className = 'form-msg';
  const firebase = {
    databaseURL: document.getElementById('newFirebaseUrl').value.trim(),
    apiKey:      document.getElementById('newFirebaseKey').value.trim(),
    projectId:   document.getElementById('newFirebaseProject').value.trim(),
  };
  const data = {
    slug:     document.getElementById('newSlug').value.trim(),
    title:    document.getElementById('newTitle').value.trim(),
    subtitle: document.getElementById('newSubtitle').value.trim(),
    date:     document.getElementById('newDate').value,
    pin:      document.getElementById('newPin').value.trim() || '1234',
    firebase,
  };
  try {
    const res = await fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Erreur'); }
    const created = await res.json();
    msg.textContent = `✓ Soirée créée : /events/${created.slug}/`;
    msg.className = 'form-msg ok';
    toast(`Soirée "${created.slug}" créée !`);
    e.target.reset();
    loadEvents();
    setTimeout(() => openEvent(created.slug), 500);
  } catch (err) {
    msg.textContent = err.message;
    msg.className = 'form-msg err';
  }
});

// ── Upload photos ───────────────────────────────────────────

function initDropzone() {
  const zone  = document.getElementById('adminDropzone');
  const input = document.getElementById('adminUploadInput');
  if (!zone || !input) return;

  zone.addEventListener('click', () => input.click());
  input.addEventListener('change', e => addToQueue(Array.from(e.target.files)));
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('drag-over');
    addToQueue(Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name)));
  });
}

function addToQueue(files) {
  files.forEach(f => {
    if (f.size > 50 * 1024 * 1024) { toast(`${f.name} dépasse 50 Mo, ignoré`); return; }
    uploadQueue.push({ file: f, status: 'pending', progress: 0 });
  });
  renderQueue();
}

function renderQueue() {
  const queueEl = document.getElementById('uploadQueue');
  const listEl  = document.getElementById('queueList');
  const countEl = document.getElementById('queueCount');
  if (!queueEl || !listEl) return;

  if (!uploadQueue.length) { queueEl.style.display = 'none'; return; }
  queueEl.style.display = 'block';
  countEl.textContent = `${uploadQueue.length} fichier(s)`;

  listEl.innerHTML = uploadQueue.map((item, i) => `
    <div class="queue-item ${item.status === 'done' ? 'done' : ''}">
      <span class="queue-item-status">${item.status === 'done' ? '✓' : item.status === 'error' ? '✕' : '📷'}</span>
      <span class="queue-item-name">${item.file.name}</span>
      <span class="queue-item-size">${(item.file.size / 1024 / 1024).toFixed(1)} Mo</span>
    </div>
    ${item.status === 'uploading' ? `<div class="queue-progress"><div class="queue-progress-fill" style="width:${item.progress}%"></div></div>` : ''}`
  ).join('');
}

document.getElementById('btnClearQueue')?.addEventListener('click', () => {
  uploadQueue = [];
  renderQueue();
  document.getElementById('adminUploadInput').value = '';
});

document.getElementById('btnUpload')?.addEventListener('click', async () => {
  if (!currentSlug || !uploadQueue.length) return;
  const pending = uploadQueue.filter(i => i.status === 'pending');
  if (!pending.length) { toast('Aucun fichier en attente'); return; }

  // Upload par lots de 20 fichiers
  const BATCH = 20;
  let totalUploaded = 0;

  for (let i = 0; i < pending.length; i += BATCH) {
    const batch = pending.slice(i, i + BATCH);
    batch.forEach(item => { item.status = 'uploading'; });
    renderQueue();

    const form = new FormData();
    batch.forEach(item => form.append('photos', item.file));

    try {
      const res = await fetch(`/api/events/${currentSlug}/photos`, { method: 'POST', body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        batch.forEach(item => { item.status = 'error'; });
        toast(`Erreur lot ${Math.floor(i/BATCH)+1} : ${err.error || res.status}`);
        renderQueue();
        continue;
      }
      const data = await res.json();
      const skippedNames = new Set((data.skipped || []).map(s => s.name));
      batch.forEach(item => { item.status = skippedNames.has(item.file.name) ? 'error' : 'done'; });
      totalUploaded += data.count || 0;
    } catch {
      batch.forEach(item => { item.status = 'error'; });
      toast(`Erreur réseau sur le lot ${Math.floor(i/BATCH)+1}`);
    }
    renderQueue();
  }

  toast(`✓ ${totalUploaded} photo(s) uploadée(s)`);
  loadPhotoPreview(currentSlug);
});

// ── Générer thumbnails + JSON ───────────────────────────────

document.getElementById('btnGenerate')?.addEventListener('click', async () => {
  if (!currentSlug) return;
  const btn = document.getElementById('btnGenerate');
  const log = document.getElementById('generateLog');
  btn.textContent = '⏳ Génération en cours…';
  btn.disabled = true;
  log.style.display = 'block';
  log.textContent = '$ Génération lancée…\n';

  try {
    const res  = await fetch(`/api/events/${currentSlug}/generate`, { method: 'POST' });
    const data = await res.json();
    log.textContent += (data.thumbnails || '') + (data.json || '');
    if (data.errors) log.textContent += `\n⚠️  Erreurs :\n${data.errors}`;
    log.textContent += `\n✓ Terminé : ${data.photoCount} photo(s) indexées`;
    document.getElementById('photoCountEl').textContent = data.photoCount;
    toast(`Génération terminée : ${data.photoCount} photos`);
    loadPhotoPreview(currentSlug);
  } catch {
    log.textContent += '\n✕ Erreur lors de la génération';
    toast('Erreur lors de la génération');
  } finally {
    btn.textContent = '⚡ Générer thumbnails + photos.json';
    btn.disabled = false;
  }
});

// ── Aperçu photos ───────────────────────────────────────────

async function loadPhotoPreview(slug) {
  const grid = document.getElementById('photosPreviewGrid');
  if (!grid) return;
  grid.innerHTML = '<p class="empty-photos">Chargement…</p>';
  try {
    const res = await fetch(`/api/events/${slug}/photos`);
    const photos = await res.json();
    if (!photos.length) { grid.innerHTML = '<p class="empty-photos">Aucune photo — uploadez des photos puis cliquez sur Générer</p>'; return; }
    grid.innerHTML = photos.map(p => {
      const thumb = p.thumb || p.src;
      return `<div class="preview-thumb" title="${p.src}">
        <img src="/events/${slug}/${thumb}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\'></svg>'">
        <button class="preview-thumb-del" onclick="deletePhoto('${slug}','${p.src.replace('photos/','')}')">✕</button>
      </div>`;
    }).join('');
    document.getElementById('photoCountEl').textContent = photos.length;
  } catch {
    grid.innerHTML = '<p class="empty-photos">Aucune donnée — génère d\'abord le photos.json</p>';
  }
}

document.getElementById('btnReloadPhotos')?.addEventListener('click', () => currentSlug && loadPhotoPreview(currentSlug));

async function deletePhoto(slug, filename) {
  confirm('Supprimer la photo', `Supprimer "${filename}" ?`, async () => {
    try {
      await fetch(`/api/events/${slug}/photos/${filename}`, { method: 'DELETE' });
      toast(`Photo "${filename}" supprimée`);
      loadPhotoPreview(slug);
    } catch {
      toast('Erreur lors de la suppression');
    }
  });
}
window.deletePhoto = deletePhoto;

// ── Init ────────────────────────────────────────────────────

loadEvents();
initDropzone();
