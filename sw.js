// Service worker: cache-first för appens egna filer (skalet), aldrig för
// api.github.com — token-försedda anrop och familjedata får inte hamna i
// någon cache. Bumpa CACHE_VERSION vid varje deploy.
const CACHE_VERSION = 'mhv-shell-v5';

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/tokens.css',
  './css/base.css',
  './css/components.css',
  './css/views.css',
  './js/app.js',
  './js/config.js',
  './js/controller.js',
  './js/data.js',
  './js/dates.js',
  './js/dev-data.js',
  './js/models.js',
  './js/router.js',
  './js/store.js',
  './js/sync.js',
  './js/store/cache.js',
  './js/store/github-store.js',
  './js/store/local-store.js',
  './js/ui/chips.js',
  './js/ui/sheet.js',
  './js/ui/toast.js',
  './js/views/idag.js',
  './js/views/vecka.js',
  './js/views/veckaPicker.js',
  './js/views/sysslor.js',
  './js/views/jobb.js',
  './js/views/jobbForm.js',
  './js/views/mer.js',
  './js/views/onboarding.js',
  './js/content/afChecklist.js',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // api.github.com m.fl. går direkt mot nätet

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req))
  );
});
