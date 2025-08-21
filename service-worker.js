self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open('vocacional-v1').then(cache => cache.addAll([
    './',
    './index.html',
    './main.js',
    './manifest.webmanifest',
    './icons/icon-192.png',
    './icons/icon-512.png'
  ])));
});
self.addEventListener('activate', (e) => { self.clients.claim(); });
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request))
  );
});