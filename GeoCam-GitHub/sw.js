// GeoCam HD service worker
// App (index.html) hamesha pehle internet se naya liya jaata hai; net na ho to phone mein rakha version chalta hai.
const CACHE = 'geocam-v8';
const LOCAL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(LOCAL.map(u => new Request(u, { cache: 'reload' })));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

function isAppFile(url){
  return url.origin === self.location.origin &&
    (url.pathname.endsWith('/') || /\/(index\.html|manifest\.json)$/.test(url.pathname));
}

async function networkFirst(req, event){
  const c = await caches.open(CACHE);
  const indexUrl = new URL('./index.html', self.location).href;
  // net se naya version laao; dheema net ho to bhi poora aane do aur save karo (agli baar kaam aaye)
  const fresh = fetch(req.url, { cache: 'no-store' }).then(async res => {
    if (res.ok){
      await c.put(req.url, res.clone());
      if (req.mode === 'navigate') await c.put(indexUrl, res.clone());
    }
    return res;
  });
  event.waitUntil(fresh.catch(() => {}));
  const timeout = new Promise(r => setTimeout(r, 10000));
  try{
    const res = await Promise.race([fresh, timeout]);
    if (res) return res;
  }catch(e){}
  return (await c.match(req.url, { ignoreSearch: true })) || (await c.match(indexUrl)) || fresh;
}

async function cacheFirst(req){
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && (res.ok || res.type === 'opaque')){ const c = await caches.open(CACHE); c.put(req, res.clone()); }
  return res;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || req.url.includes('nominatim.openstreetmap.org')) return;
  const url = new URL(req.url);
  if (req.mode === 'navigate' || isAppFile(url)) e.respondWith(networkFirst(req, e));
  else e.respondWith(cacheFirst(req));
});
