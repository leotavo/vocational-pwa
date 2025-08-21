self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open('vocacional-v2').then(cache => cache.addAll([
    './',
    './index.html',
    './main.js',
    './manifest.webmanifest'
  ])));
});
self.addEventListener('activate', (e) => { self.clients.claim(); });
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request))
  );
});
