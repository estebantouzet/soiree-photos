import { state } from './state.js';
import { showToast, getUserFingerprint } from './utils.js';

let uploadFiles = [];

// ── Partage photo ──────────────────────────────────────────

export async function shareSinglePhoto() {
  if (state.lightboxIdx === null) return;
  const p = state.photos.find(ph => ph.id === state.lightboxIdx);
  if (!p) return;

  if (navigator.share) {
    try {
      const resp = await fetch(p.src);
      const blob = await resp.blob();
      const file = new File([blob], p.src.split('/').pop(), { type: blob.type });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: state.eventConfig.title || 'Soirée', text: p.time || '' });
        return;
      }
    } catch {}
    try { await navigator.share({ title: state.eventConfig.title || 'Soirée', url: window.location.href }); } catch {}
  } else {
    navigator.clipboard.writeText(window.location.href)
      .then(()  => showToast('Lien copié dans le presse-papier 📋'))
      .catch(()  => showToast('Partage non supporté sur ce navigateur'));
  }
}

export async function shareSite() {
  const title = state.eventConfig.title || 'Album soirée';
  if (navigator.share) {
    try { await navigator.share({ title, url: window.location.href }); } catch {}
  } else {
    navigator.clipboard.writeText(window.location.href)
      .then(()  => showToast('Lien copié 📋'))
      .catch(()  => showToast('Copie non supportée'));
  }
}

// ── Upload invités ─────────────────────────────────────────

export function openUploadModal() {
  const modal = document.getElementById('upload-modal');
  if (!modal) return;

  if (!window.firebaseStorage) {
    const content = document.querySelector('.upload-modal-content');
    if (content) content.innerHTML = `
      <button class="upload-modal-close" onclick="closeUploadModal()">✕</button>
      <div class="upload-not-configured">
        <strong>⚙️ Configuration requise</strong>
        Firebase Storage n'est pas encore configuré.<br>
        Contacte l'admin de l'album pour activer l'upload.
      </div>`;
    modal.classList.remove('hidden');
    return;
  }

  modal.classList.remove('hidden');
  const dropzone = document.getElementById('uploadDropzone');
  if (dropzone && !dropzone._init) {
    dropzone._init = true;
    dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
    dropzone.addEventListener('drop', e => {
      e.preventDefault(); dropzone.classList.remove('drag-over');
      addUploadFiles(Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/')));
    });
    document.getElementById('uploadInput')?.addEventListener('change', e => addUploadFiles(Array.from(e.target.files)));
  }
}

export function closeUploadModal() {
  document.getElementById('upload-modal')?.classList.add('hidden');
  uploadFiles = [];
  const list = document.getElementById('uploadPreviewList');
  if (list) list.innerHTML = '';
  const btn = document.getElementById('uploadSubmitBtn');
  if (btn) btn.disabled = true;
  const input = document.getElementById('uploadInput');
  if (input) input.value = '';
}

function addUploadFiles(files) {
  files.forEach(file => {
    if (file.size > 20 * 1024 * 1024) { showToast(`${file.name} dépasse 20 Mo`); return; }
    uploadFiles.push(file);
    renderPreviewItem(file);
  });
  const btn = document.getElementById('uploadSubmitBtn');
  if (btn) btn.disabled = uploadFiles.length === 0;
}

function renderPreviewItem(file) {
  const list = document.getElementById('uploadPreviewList');
  if (!list) return;
  const item = document.createElement('div');
  item.className = 'upload-preview-item';
  item.dataset.name = file.name;
  const url = URL.createObjectURL(file);
  item.innerHTML = `<img src="${url}" loading="lazy">
    <button class="upload-preview-remove" onclick="this.parentElement.remove(); window._removeUploadFile?.('${file.name}')">✕</button>`;
  list.appendChild(item);
  window._removeUploadFile = name => {
    uploadFiles = uploadFiles.filter(f => f.name !== name);
    const btn = document.getElementById('uploadSubmitBtn');
    if (btn) btn.disabled = uploadFiles.length === 0;
  };
}

export async function submitUpload() {
  if (!window.firebaseStorage || uploadFiles.length === 0) return;
  const nameInput     = document.getElementById('uploaderName');
  const uploaderName  = nameInput?.value.trim() || 'Invité';
  const { getStorage, storageRef, uploadBytesResumable, getDownloadURL } = window.firebaseStorage;
  const { getApps, initializeApp, getDatabase, ref, push, set } = window.firebaseApp;
  const cfg = state.eventConfig?.firebase;
  const app = getApps().length ? getApps()[0] : initializeApp(cfg);
  const storage  = getStorage(app);
  const database = getDatabase(app);

  const submitBtn = document.getElementById('uploadSubmitBtn');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Envoi en cours…'; }

  const items = document.querySelectorAll('.upload-preview-item');
  const fp    = getUserFingerprint();

  const promises = uploadFiles.map((file, i) => new Promise((resolve, reject) => {
    const path  = `guest-uploads/${state.eventSlug}/${Date.now()}_${file.name}`;
    const sRef  = storageRef(storage, path);
    const task  = uploadBytesResumable(sRef, file, { customMetadata: { uploaderName, fingerprint: fp } });
    task.on('state_changed',
      snap => {
        const pct = Math.round(snap.bytesTransferred / snap.totalBytes * 100);
        const item = items[i];
        if (!item) return;
        let overlay = item.querySelector('.upload-progress-overlay');
        if (!overlay) { overlay = document.createElement('div'); overlay.className = 'upload-progress-overlay'; item.appendChild(overlay); }
        overlay.innerHTML = `<span>${pct}%</span>`;
      },
      err => { showToast(`Erreur : ${err.message}`); reject(err); },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        const item = items[i];
        if (item) { item.querySelector('.upload-progress-overlay')?.remove(); const c = document.createElement('div'); c.className = 'upload-done-check'; c.textContent = '✓'; item.appendChild(c); }
        const newRef = push(ref(database, `guest-photos/${state.eventSlug}`));
        set(newRef, { url, name: file.name, uploaderName, ts: Date.now(), fingerprint: fp });
        resolve(url);
      }
    );
  }));

  try {
    await Promise.all(promises);
    showToast('Photos envoyées avec succès 🎉');
    setTimeout(closeUploadModal, 1500);
  } catch {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Réessayer'; }
  }
}
