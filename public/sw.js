// Cache public assets only. Account, photo, API and payment responses stay on the network.
const CACHE = 'eyeknow-public-v2';
const PREFIX = 'eyeknow-public-';
const LIMIT = 160;
const SHELL = ['/icon-192.png', '/icon-512.png', '/icon.svg', '/logo.svg', '/manifest.webmanifest'];
const PUBLIC_ASSET = /^\/(?:icon(?:-192|-512|-maskable-512)?\.(?:png|svg)|apple-touch-icon\.png|logo\.svg|manifest\.webmanifest|demo-iris(?:-[a-z]+)?\.jpg|iridology-chart\.jpg|creator-portrait\.jpg|palm-slide-[1-6]\.jpg|(?:book-covers|diet|includes|share-art)\/.+\.(?:png|jpe?g|webp|avif|svg))$/i;
const OFFLINE = '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>eyeKnow — offline</title><body style="background:#090d18;color:#f4f5fa;font-family:system-ui;padding:48px 24px;text-align:center"><h1>eyeKnow</h1><p>You are offline. Reconnect to open the app.</p><button onclick="location.reload()">Try again</button></body></html>';
let writes = Promise.resolve();
function remember(request, response) {
  writes = writes.catch(() => {}).then(async () => {
    if (!response.ok || response.type !== 'basic' || response.redirected) return;
    if (/no-store|private/i.test(response.headers.get('cache-control') || '')) return;
    if ((response.headers.get('vary') || '').includes('*')) return;
    const cache = await caches.open(CACHE);
    await cache.put(request, response);
    const keys = await cache.keys();
    for (const key of keys.slice(0, Math.max(0, keys.length - LIMIT))) await cache.delete(key);
  });
  return writes;
}
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    await Promise.all(SHELL.map(async path => {
      try { await remember(new Request(new URL(path, self.location.origin)), await fetch(path)); } catch {}
    }));
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key === 'eyeknow-shell-v1' || (key.startsWith(PREFIX) && key !== CACHE)).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => new Response(OFFLINE, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })));
    return;
  }
  if (url.search || !(url.pathname.startsWith('/_next/static/') || PUBLIC_ASSET.test(url.pathname))) return;
  const result = (async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(request);
    if (hit) return { response: hit };
    const response = await fetch(request);
    return { response, write: remember(request, response.clone()) };
  })();
  event.respondWith(result.then(value => value.response));
  event.waitUntil(result.then(value => value.write).catch(() => {}));
});
self.addEventListener('push', event => {
  let payload = { title: 'eyeKnow', body: 'Your reading is waiting.', url: '/' };
  try { if (event.data) payload = { ...payload, ...event.data.json() }; } catch {}
  event.waitUntil(self.registration.showNotification(payload.title, { body: payload.body, icon: '/apple-touch-icon.png', badge: '/apple-touch-icon.png', data: { url: payload.url } }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  let url = new URL('/', self.location.origin);
  try {
    const candidate = new URL(event.notification.data?.url || '/', self.location.origin);
    if (candidate.origin === self.location.origin) url = candidate;
  } catch {}
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async wins => {
    for (const win of wins) {
      if ('focus' in win) { await win.navigate(url.href).catch(() => {}); return win.focus(); }
    }
    return self.clients.openWindow(url.href);
  }));
});
