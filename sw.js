// Service worker de la version web : l'app s'ouvre même sans réseau.
// Fichiers de l'app : réseau d'abord (pour avoir la dernière version), cache en secours.
// La base en ligne et les modèles (Whisper) ne passent pas par ici.
const CACHE = 'teachtime-v2';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', 'index.html', 'renderer/style.css', 'renderer/app.js', 'renderer/web/boot.js', 'renderer/web/web-api.js', 'renderer/web/config.js', 'renderer/lib/cloud-core.js', 'manifest.webmanifest'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
        return r;
      })
      .catch(() => caches.match(e.request).then((m) => m || caches.match('index.html'))),
  );
});
