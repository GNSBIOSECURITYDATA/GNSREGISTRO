/* BioAcceso · GNS Agroprocesos — service worker
   v7: red-primero estricto para HTML; nunca sirve HTML viejo si hay internet.
   Esto evita el caso en que la app quedaba ejecutando una version vieja en cache
   y solo Ctrl+Shift+R la arreglaba. */
const CACHE = 'bioacceso-v7';
const ASSETS = ['manifest.json','icon-192.png','icon-512.png','icon-maskable-512.png','apple-touch-icon.png'];

self.addEventListener('install', e => {
  // Toma control de inmediato sin esperar.
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(()=>{})));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const req = e.request, url = new URL(req.url);

  // Solo gestionamos peticiones de nuestro propio origen.
  if (url.origin !== self.location.origin) return;

  // version.txt: SIEMPRE de internet, jamas cache.
  if (url.pathname.endsWith('version.txt')) {
    e.respondWith(fetch(req, {cache: 'no-store'}).catch(() => new Response('', {status: 204})));
    return;
  }

  // Documento HTML (navegacion): RED PRIMERO, estricto.
  // Pide SIEMPRE la version fresca a internet. Solo si NO hay red usa la copia
  // guardada como respaldo. Nunca sirve HTML viejo estando en linea.
  const isDoc = req.mode === 'navigate'
             || req.destination === 'document'
             || url.pathname.endsWith('.html')
             || url.pathname === '/' || url.pathname.endsWith('/');
  if (isDoc) {
    e.respondWith(
      fetch(req, {cache: 'no-store'})
        .then(resp => {
          // Guarda copia fresca para usar solo si luego no hay internet.
          const cp = resp.clone();
          caches.open(CACHE).then(c => c.put('index.html', cp)).catch(()=>{});
          return resp;
        })
        .catch(() => caches.match('index.html').then(hit => hit || caches.match('./')))
    );
    return;
  }

  // Iconos y estaticos pequeños: cache primero (rara vez cambian).
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(resp => {
      const cp = resp.clone();
      caches.open(CACHE).then(c => c.put(req, cp)).catch(()=>{});
      return resp;
    }).catch(()=>hit))
  );
});
