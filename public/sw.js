const CACHE_NAME = "provenance-public-shell-v1";
const SHELL_URL = "/";

function cacheable(response) {
  if (!response || !response.ok) return false;
  const policy = (response.headers.get("cache-control") || "").toLowerCase();
  return !policy.includes("no-store") && !policy.includes("private");
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch(SHELL_URL, { credentials: "same-origin" });
      if (cacheable(response)) await cache.put(SHELL_URL, response);
    } catch {
      // First install can still succeed without a network shell snapshot.
    }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith("provenance-public-shell-") && name !== CACHE_NAME).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (cacheable(response) && url.pathname === "/") {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(SHELL_URL, response.clone());
        }
        return response;
      } catch {
        return (await caches.match(SHELL_URL)) || Response.error();
      }
    })());
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname === "/manifest.webmanifest") {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (cacheable(response)) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    })());
  }
});
