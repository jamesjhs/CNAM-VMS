// CNAM VMS — Service Worker
// Caches immutable Next.js static assets for performance.
// All other requests (navigation, API, auth) go straight to the network
// so the authentication flow is never disrupted.

const CACHE_NAME = 'cnam-vms-static-v1';

// Only cache the immutable, content-hashed assets produced by Next.js.
// These URLs contain a hash so old entries are never stale.
const STATIC_RE = /^\/_next\/static\//;

// Additional static public files worth caching after first visit.
const PUBLIC_RE = /^\/(?:favicon\.svg|icon-192\.png|icon-512\.png|apple-touch-icon\.png|manifest\.json|robots\.txt)$/;

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  // Skip the waiting phase so the new SW activates immediately.
  self.skipWaiting();
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  // Only handle GET requests.
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Cache-first for immutable Next.js static assets and small public files.
  if (STATIC_RE.test(url.pathname) || PUBLIC_RE.test(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // All other requests (pages, API routes, auth) use the browser default
  // network fetch — no interception, no risk of serving stale auth state.
});
