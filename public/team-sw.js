// eyeKnow Team PWA service worker — deliberately conservative.
// API calls are never intercepted, pages are network-first (the
// dashboard must never serve stale earnings), and only static
// shell assets are cached, for installability and a soft offline
// landing. Cache name is versioned; bump it to retire old shells.
var CACHE = "eyeknow-team-v1";
var SHELL = [
  "/team.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(function (c) {
        return c.addAll(SHELL);
      })
      .then(function () {
        return self.skipWaiting();
      }),
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys
            .filter(function (k) {
              return k !== CACHE;
            })
            .map(function (k) {
              return caches.delete(k);
            }),
        );
      })
      .then(function () {
        return self.clients.claim();
      }),
  );
});

self.addEventListener("fetch", function (event) {
  var url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.indexOf("/api/") === 0) return; // never intercept the API
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then(function (res) {
          var copy = res.clone();
          caches
            .open(CACHE)
            .then(function (c) {
              return c.put("/", copy);
            })
            .catch(function () {});
          return res;
        })
        .catch(function () {
          return caches.match("/");
        }),
    );
    return;
  }
  if (SHELL.indexOf(url.pathname) >= 0 || url.pathname.indexOf("/_next/static/") === 0) {
    event.respondWith(
      caches.match(event.request).then(function (hit) {
        return (
          hit ||
          fetch(event.request).then(function (res) {
            var copy = res.clone();
            caches
              .open(CACHE)
              .then(function (c) {
                return c.put(event.request, copy);
              })
              .catch(function () {});
            return res;
          })
        );
      }),
    );
  }
});
