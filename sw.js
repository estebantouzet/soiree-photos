const CACHE = 'album-mae-v1';
const STATIC = ['/', '/index.html', '/app.js', '/style.css', '/photos.json',
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&display=swap'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = e.request.url;
  // Bypass Firebase + external requests
  if (url.includes('firebase') || url.includes('googleapis') || url.includes('gstatic')) return;
  // Photos : network first (fraîcheur), fallback cache
  if (url.includes('/photos/')) {
    e.respondWith(fetch(e.request).then(r => {
      const clone = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return r;
    }).catch(() => caches.match(e.request)));
    return;
  }
  // Assets statiques : cache first
  e.respondWith(caches.match(e.request).then(cached => cached || fetch(e.request)));
});
