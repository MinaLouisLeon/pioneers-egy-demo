/*
 * Service worker for the Pioneers-EGY PWA.
 *
 * Written by hand rather than generated, because this app's caching rules are
 * unusually strict and a generic "cache everything" worker would be actively
 * harmful here:
 *
 *   - Inspection data is per-user and RLS-scoped. Caching an authenticated HTML
 *     response could serve one inspector's jobs to whoever installs the app
 *     next on a shared site tablet.
 *   - Photo and certificate URLs are short-lived presigned R2 links. A cached
 *     one is a broken one within minutes.
 *   - Certificate verification must always hit the network so revocation is
 *     honoured immediately.
 *
 * So: static build assets are cached (they are content-hashed and public),
 * navigations are network-first with an offline fallback page, and everything
 * else — API routes, Supabase, R2 — is never touched.
 */

const VERSION = "v1";
const STATIC_CACHE = `pioneers-static-${VERSION}`;
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL]))
      // Take over as soon as possible so the offline page is available on the
      // first run rather than the second.
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("pioneers-") && key !== STATIC_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest"
  );
}

function isNeverCached(url) {
  return (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/") ||
    url.pathname.startsWith("/verify/")
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only GETs are ever cacheable, and only same-origin: Supabase and R2 are
  // cross-origin and must always go straight to the network.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isNeverCached(url)) return;

  if (isStaticAsset(url)) {
    // Content-hashed and immutable — cache-first is safe and fast.
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  if (request.mode === "navigate") {
    // Network-first. Responses are deliberately NOT cached — they contain
    // user-specific data. The cache only ever provides the offline page.
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(STATIC_CACHE);
        return (await cache.match(OFFLINE_URL)) ?? Response.error();
      }),
    );
  }
});
