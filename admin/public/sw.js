const CACHE = 'onetask-v1';
const SHELL = [
  '/',
  '/devices',
  '/logo.jpg',
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) =>
      Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // API calls: network only (no cache JWT/data)
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/') || url.pathname === '/health') {
    e.respondWith(fetch(e.request));
    return;
  }

  // Navigation: network-first, fallback to cache
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request).then((r) => r || caches.match('/'))),
    );
    return;
  }

  // Static assets: cache-first
  e.respondWith(
    caches.match(e.request).then((r) => r || fetch(e.request)),
  );
});
