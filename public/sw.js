const SHELL_CACHE = 'agazaty-shell-v15';
const SHELL = ['./', './index.html', './theme.css?v=10', './design.css?v=3', './firebase-cloud.js?v=4', './manifest.webmanifest?v=2', './assets/app-logo.png?v=2', './assets/agazaty.ico?v=2', './assets/install-qr.svg?v=4', './assets/windows-qr.svg?v=2', './assets/icon-192.png?v=2', './assets/icon-512.png?v=2'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL_CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([caches.keys().then(keys => Promise.all(keys.filter(key => key !== SHELL_CACHE).map(key => caches.delete(key)))), self.clients.claim()]));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  if (['/apk', '/windows'].includes(new URL(event.request.url).pathname)) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('./index.html')));
  } else if (SHELL.some(path => new URL(path, self.registration.scope).href === event.request.url)) {
    event.respondWith(fetch(event.request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        event.waitUntil(caches.open(SHELL_CACHE).then(cache => cache.put(event.request, copy)));
      }
      return response;
    }).catch(() => caches.match(event.request)));
  }
});
