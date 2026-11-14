const CACHE_NAME = 'pulse-v43';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './icon-maskable.svg',
  './fonts/figtree.woff2',
  './images/crunches.svg',
  './images/high-knees.svg',
  './images/jumping-jacks.svg',
  './images/lunges.svg',
  './images/plank.svg',
  './images/push-ups-rotation.svg',
  './images/push-ups.svg',
  './images/side-plank.svg',
  './images/squats.svg',
  './images/step-ups.svg',
  './images/triceps-dips.svg',
  './images/wall-sit.svg',
];
// Fetched on first use and kept for offline: wger exercise images.
const RUNTIME = /^https:\/\/wger\.de\/media\//;

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  // Network-first for navigation, cache-first for assets
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
  } else {
    const keep = e.request.method === 'GET' &&
      (new URL(e.request.url).origin === self.location.origin || RUNTIME.test(e.request.url));
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        // Opaque (no-cors) responses report status 0 but are still usable.
        if (keep && (res.ok || res.type === 'opaque')) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      }))
    );
  }
});
