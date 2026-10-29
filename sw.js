const CACHE_NAME = "aquassist-cache-v32";
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon.png",
  "./icon-512.png",
  "./icon-192.png",
  "./icon-maskable-512.png",
  "./icon-maskable-192.png",
  "./icon.svg",
  "./icon-header.png",
  "./apple-touch-icon.png"
];

// Install: Cache critical assets fresh from network (bypassing HTTP cache)
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        ASSETS_TO_CACHE.map((url) =>
          fetch(new Request(url, { cache: "reload" }))
            .then((res) => (res && res.ok ? cache.put(url, res) : cache.add(url)))
            .catch(() => cache.add(url))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// Activate: Clean up old caches immediately
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Network-first for HTML navigation so updates apply immediately; stale-while-revalidate for static assets
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || event.request.url.includes("googleapis.com")) {
    return;
  }

  const reqUrl = new URL(event.request.url);
  const isHtmlNav =
    event.request.mode === "navigate" ||
    reqUrl.pathname.endsWith("/") ||
    reqUrl.pathname.endsWith("/index.html");

  if (isHtmlNav) {
    event.respondWith(
      fetch(event.request, { cache: "no-cache" })
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request).then((res) => res || caches.match("./index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// Notification click handler: focus or open the app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow("./index.html");
      }
    })
  );
});
