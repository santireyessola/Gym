/* Service worker de Mis Rutinas: la app funciona offline.
   index.html se busca primero en la red (para recibir actualizaciones)
   y cae al caché si no hay conexión. El resto se sirve del caché.
   Además programa la notificación de "descanso terminado" del cronómetro. */
const CACHE = 'rutinas-v3';
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

/* ---- CRONÓMETRO: aviso al llegar a 0 ----
   La página manda {tipo:'timer', ms} al empezar un descanso. El waitUntil mantiene
   vivo al service worker hasta que se dispara, así el aviso llega aunque la app
   quede en segundo plano. Si la app está visible no se notifica: en ese caso la
   propia página avisa con sonido, vibración y el cartel del cronómetro. */
let timerId = null;

self.addEventListener('message', e => {
  const d = e.data || {};
  if (d.tipo === 'timer') {
    clearTimeout(timerId);
    const ms = Math.max(0, Math.min(30 * 60000, +d.ms || 0));
    e.waitUntil(new Promise(listo => {
      timerId = setTimeout(() => { timerId = null; avisar().then(listo, listo); }, ms);
    }));
  } else if (d.tipo === 'cancelar') {
    clearTimeout(timerId); timerId = null;
  }
});

function avisar() {
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    if (cs.some(c => c.visibilityState === 'visible')) return;
    return self.registration.showNotification('¡Descanso terminado!', {
      body: 'Volvé a la barra 💪',
      tag: 'descanso-rutinas',
      renotify: true,
      vibrate: [200, 100, 200],
      icon: './icon-192.png',
      badge: './icon-192.png'
    });
  }).catch(() => {});
}

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
      for (const c of cs) { if ('focus' in c) return c.focus(); }
      if (self.clients.openWindow) return self.clients.openWindow('./');
    })
  );
});
