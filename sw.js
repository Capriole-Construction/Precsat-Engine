// Precast Production Engine — Service Worker
// Network-first for HTML so deploys are picked up without a hard refresh.
// Stale-while-revalidate for static assets. Cloud APIs always go to network.

const CACHE = 'precast-v2';
const SHELL = [
  '/Precsat-Engine/',
  '/Precsat-Engine/index.html',
  '/Precsat-Engine/manifest.json'
];

// Install: pre-cache the app shell, take over immediately
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

// Activate: remove old caches and claim clients so the new SW controls the page
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Allow page to force activation
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);

  // Cross-origin (cloud, proxy) — straight to network, fall back to cache only if offline
  if (url.hostname !== location.hostname) {
    e.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }

  // Non-GET — never cache
  if (req.method !== 'GET') { e.respondWith(fetch(req)); return; }

  const isHTML = req.mode === 'navigate'
    || req.destination === 'document'
    || (req.headers.get('accept') || '').includes('text/html')
    || url.pathname.endsWith('/')
    || url.pathname.endsWith('.html');

  if (isHTML) {
    // Network-first: always try fresh HTML so deploys appear without hard refresh
    e.respondWith(
      fetch(req).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(req, clone));
        }
        return res;
      }).catch(() => caches.match(req).then(c => c || caches.match('/Precsat-Engine/index.html')))
    );
    return;
  }

  // Stale-while-revalidate for other same-origin assets (icons, manifest, etc.)
  e.respondWith(
    caches.match(req).then(cached => {
      const fresh = fetch(req).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(req, clone));
        }
        return res;
      }).catch(() => cached);
      return cached || fresh;
    })
  );
});
