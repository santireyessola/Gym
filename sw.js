/* Service worker de Mis Rutinas: la app funciona offline.
   index.html se busca primero en la red (para recibir actualizaciones)
   y cae al caché si no hay conexión. El resto se sirve del caché. */
const CACHE = 'rutinas-v1';
const ARCHIVOS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.mode === 'navigate' || url.pathname.endsWith('/index.html')) {
    e.respondWith(
      fetch(e.request).then(res => {
        const copia = res.clone();
        caches.open(CACHE).then(c => { c.put('./index.html', copia); });
        return res;
      }).catch(() => caches.match('./index.html'))
    );
  } else {
    e.respondWith(
      caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request))
    );
  }
});
