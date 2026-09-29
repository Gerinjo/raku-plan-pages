// Cache only offline help. Calendars, accounts, API responses and bookings
// always use the network so an installed app cannot serve stale availability.
const scope = new URL(self.registration.scope);
const cachePrefix = `raku-offline:${scope.pathname}:`;
const cacheName = `${cachePrefix}v1`;
const offlineUrl = new URL("offline.html", scope).href;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(cacheName);
      await cache.add(new Request(offlineUrl, { cache: "reload" }));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith(cachePrefix) && name !== cacheName)
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  const relativePath = url.pathname.slice(scope.pathname.length);
  if (
    request.method !== "GET" ||
    request.mode !== "navigate" ||
    url.origin !== scope.origin ||
    !url.pathname.startsWith(scope.pathname) ||
    relativePath === "api" ||
    relativePath.startsWith("api/") ||
    /\.[^/]+\/?$/.test(relativePath)
  )
    return;

  event.respondWith(
    (async () => {
      try {
        return await fetch(request);
      } catch {
        const cache = await caches.open(cacheName);
        return (
          (await cache.match(offlineUrl)) ||
          new Response(
            "Du bist offline. Verbinde dich mit dem Internet und lade den Belegungsplan erneut.",
            {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            },
          )
        );
      }
    })(),
  );
});
