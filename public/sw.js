const CACHE = "clube-adoce-v3";
const SHELL = [
  "/site/logo.webp",
  "/manifest-clube.webmanifest",
  "/manifest-operacao.webmanifest",
  "/pwa/clube/icon-192.png",
  "/pwa/clube/icon-512.png",
  "/pwa/clube/apple-touch-icon.png",
  "/pwa/operacao/icon-192.png",
  "/pwa/operacao/icon-512.png",
  "/pwa/operacao/apple-touch-icon.png",
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  if (new URL(event.request.url).origin !== self.location.origin) return;
  if (event.request.mode === "navigate" || new URL(event.request.url).pathname.startsWith("/assets/")) return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(event.request, copy));
    }
    return response;
  })));
});
