const VERSION = 'dev';
const CACHE = 'zuschnitt-' + VERSION;
const SHELL = ['./', 'index.html', 'zuschnitt.js', 'manifest.webmanifest', 'icon.svg'];
const OPTIONAL = ['icon-192.png', 'icon-512.png'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll(SHELL).then(() =>
        Promise.all(OPTIONAL.map((url) => cache.add(url).catch(() => null)))
      )
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('zuschnitt-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const istSeite = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');
  if (istSeite) {
    // index.html zuerst aus dem Netz, nur offline aus dem Cache
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const kopie = res.clone();
            caches.open(CACHE).then((c) => c.put('index.html', kopie));
          }
          return res;
        })
        .catch(() => caches.match('index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((treffer) => treffer || fetch(req).then((res) => {
      if (res.ok) {
        const kopie = res.clone();
        caches.open(CACHE).then((c) => c.put(req, kopie));
      }
      return res;
    }))
  );
});
