// Cache only the public application shell. Auth, financial responses and
// documents are never cached.
const CACHE = "fin-family-shell-v2";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cachesToDelete = (await caches.keys()).filter(
        (key) => key.startsWith("fin-family-shell-") && key !== CACHE,
      );
      await Promise.all(cachesToDelete.map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin)
    return;

  const isShell =
    event.request.mode === "navigate" ||
    /\/assets\/[^/]+\.(js|css)$/.test(url.pathname) ||
    /\/(icon\.svg|manifest\.webmanifest)$/.test(url.pathname);
  if (!isShell) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE).then((cache) => cache.put(event.request, copy)));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === "navigate") {
          const cachedHome = await caches.match(new URL("./", self.location).href);
          if (cachedHome) return cachedHome;
        }
        return Response.error();
      }),
  );
});
