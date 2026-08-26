const CACHE = "clube-adoce-v4";
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

self.addEventListener("push", event => {
  let payload = {};
  try {
    payload = event.data?.json() || {};
  } catch {
    payload = { title: "Novo alerta na Operação Adoce" };
  }
  event.waitUntil(self.registration.showNotification(
    payload.title || "Novo alerta na Operação Adoce",
    {
      body: payload.body || "Abra a Operação Adoce para conferir com segurança.",
      icon: "/pwa/operacao/icon-192.png",
      badge: "/pwa/operacao/icon-192.png",
      tag: payload.tag || "adoce-operation-alert",
      renotify: Boolean(payload.urgent),
      data: { url: payload.url || "/#operacao" },
    },
  ));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/#operacao", self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) {
      await existing.navigate(targetUrl);
      return existing.focus();
    }
    return self.clients.openWindow(targetUrl);
  })());
});
