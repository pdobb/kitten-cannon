// Caches the single-file game so a home-screen install still runs offline.
// The page inlines its script, its style, and its fonts. Paths are relative
// to this file, which sits next to index.html on Pages.

const CACHE = 'kitten-cannon-v2';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './favicon.ico',
  './favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/sw.js')) return;

  if (request.mode === 'navigate') {
    event.respondWith(fromNetwork(request));
    return;
  }
  event.respondWith(fromCache(request));
});

async function cachedPage(cache, request) {
  return (await cache.match(request))
    || (await cache.match(request, { ignoreSearch: true }))
    || (await cache.match('./index.html'))
    || (await cache.match('./'));
}

async function fromNetwork(request) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(request);
    if (fresh.ok) {
      cache.put(request, fresh.clone());
      cache.put('./index.html', fresh.clone());
    }
    return fresh;
  } catch {
    return (await cachedPage(cache, request)) || new Response('', { status: 503, statusText: 'offline' });
  }
}

async function fromCache(request) {
  const cache = await caches.open(CACHE);
  const hit = (await cache.match(request)) || (await cache.match(request, { ignoreSearch: true }));
  if (hit) return hit;
  try {
    const fresh = await fetch(request);
    if (fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch {
    return new Response('', { status: 503, statusText: 'offline' });
  }
}
