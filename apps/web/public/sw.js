// Service worker minimal JAMPACK — coquille applicative hors-ligne pour la PWA mobile.
// Stratégie : réseau d'abord (données fraîches), repli cache pour la navigation hors-ligne.
// Les appels API (/trpc) ne sont JAMAIS mis en cache (données sensibles + fraîcheur).
const CACHE = 'jampack-shell-v1';
const SHELL = ['/', '/m', '/manifest.webmanifest', '/favicon.svg', '/brand/jampack-mark.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.pathname.startsWith('/trpc')) return; // API : toujours réseau, jamais de cache
  e.respondWith(
    fetch(req)
      .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; })
      .catch(() => caches.match(req).then((r) => r || caches.match('/m')))
  );
});
