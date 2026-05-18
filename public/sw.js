// TravPad offline Service Worker.
//
// Deliberately narrow: it only touches map tiles, hashed build assets and
// top-level page navigations. It does NOT intercept Next.js's internal
// navigation (RSC) requests or API calls — those are left to the browser so
// in-app navigation keeps working normally.

const CACHE = "travpad-shell-v2";

const TILE_HOSTS = [
  "tile.openstreetmap.org",
  "basemaps.cartocdn.com",
  "tiles.stadiamaps.com",
];

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => n !== CACHE).map((n) => caches.delete(n))
      );
      await self.clients.claim();
    })()
  );
});

// Minimal read from the offline IndexedDB — used as the tile fallback.
function openOfflineDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("travpad-offline", 1);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getTileBlob(url) {
  try {
    const db = await openOfflineDB();
    return await new Promise((resolve) => {
      const tx = db.transaction("tiles", "readonly");
      const req = tx.objectStore("tiles").get(url);
      req.onsuccess = () => resolve(req.result ? req.result.blob : null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

function isTileRequest(url) {
  return TILE_HOSTS.some((host) => url.hostname.endsWith(host));
}

// Tile servers use interchangeable subdomains (a/b/c); strip it so the key
// matches what src/lib/offline/download.ts stored.
function normalizeTileUrl(urlString) {
  try {
    const u = new URL(urlString);
    u.hostname = u.hostname.replace(/^[a-d]\./, "");
    return u.toString();
  } catch {
    return urlString;
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Map tiles — network first, downloaded copy as the offline fallback.
  if (isTileRequest(url)) {
    event.respondWith(
      fetch(request).catch(async () => {
        const blob = await getTileBlob(normalizeTileUrl(request.url));
        if (blob) {
          return new Response(blob, {
            headers: { "Content-Type": "image/png" },
          });
        }
        return new Response("", { status: 504 });
      })
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Top-level page loads — network first; offline, serve the cached shell.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(request);
          if (res.ok && !res.redirected) {
            const cache = await caches.open(CACHE);
            cache.put("app-shell", res.clone()).catch(() => {});
          }
          return res;
        } catch {
          const shell = await caches.match("app-shell");
          return shell || new Response("Offline", { status: 504 });
        }
      })()
    );
    return;
  }

  // Hashed build assets — cache first (immutable).
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        try {
          const res = await fetch(request);
          if (res.ok) {
            const cache = await caches.open(CACHE);
            cache.put(request, res.clone()).catch(() => {});
          }
          return res;
        } catch {
          return new Response("", { status: 504 });
        }
      })()
    );
    return;
  }

  // Everything else (Next.js navigation/RSC requests, API calls) — leave to
  // the browser so in-app navigation is never intercepted.
});
