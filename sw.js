/* BioAcceso · GNS Agroprocesos — service worker (network-first para HTML) */
const CACHE = 'bioacceso-v5';
const ASSETS = ['./','manifest.json','icon-192.png','icon-512.png','icon-maskable-512.png','apple-touch-icon.png'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(()=>{})));
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const req = e.request, url = new URL(req.url);

  // version.txt: SIEMPRE de internet, nunca cache (así detecta updates).
  if (url.pathname.endsWith('version.txt')) {
    e.respondWith(fetch(req, {cache: 'no-store'}).catch(() => new Response('', {status: 204})));
    return;
  }

  const isDoc = req.mode === 'navigate' || req.destination === 'document'
             || url.pathname.endsWith('.html') || url.pathname.endsWith('/');
  if (isDoc) {
    // Documento: SIEMPRE de internet sin pasar por el cache HTTP del navegador.
    // Si no hay red, usa la copia guardada. Asi la app se actualiza sola.
    e.respondWith(
      fetch(req, {cache: 'reload'}).then(resp => {
        const cp = resp.clone();
        caches.open(CACHE).then(c => c.put('./', cp)).catch(()=>{});
        return resp;
      }).catch(() => caches.match('./'))
    );
    return;
  }
  // Íconos y estáticos: usa el guardado si existe.
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(resp => {
      const cp = resp.clone();
      caches.open(CACHE).then(c => c.put(req, cp)).catch(()=>{});
      return resp;
    }))
  );
});
