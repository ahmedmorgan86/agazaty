const SHELL_CACHE = 'agazaty-shell-v8';
const SHELL = ['./', './index.html', './theme.css?v=8', './firebase-cloud.js?v=4', './assets/mark.svg', './assets/install-qr.svg', './assets/icon-192.png', './assets/icon-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL_CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([caches.keys().then(keys => Promise.all(keys.filter(key => key !== SHELL_CACHE).map(key => caches.delete(key)))), self.clients.claim()]));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  if (new URL(event.request.url).pathname === '/apk') return;
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
