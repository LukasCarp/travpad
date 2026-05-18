// TravPad offline Service Worker.
//
// Strategy (always network-first, so the online experience is unchanged):
//   - map tiles       -> network; if offline, serve the downloaded copy
//                        from IndexedDB.
//   - the app's files -> network; cache the result; if offline, serve the
//                        cached copy (Cache API) so the app still starts.
//   - everything else -> left untouched.

const CACHE = "travpad-shell-v1";

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

// Minimal read from the offline IndexedDB (the same DB src/lib/offline/db.ts
// writes to). Only used as the offline fallback for tiles.
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

  // The app's own files — network first, cache for offline start-up.
  if (url.origin === self.location.origin) {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(request);
          if (res.ok && !res.redirected) {
            const cache = await caches.open(CACHE);
            cache.put(request, res.clone()).catch(() => {});
          }
          return res;
        } catch {
          const cached = await caches.match(request);
          if (cached) return cached;
          return new Response("", { status: 504 });
        }
      })()
    );
    return;
  }

  // Everything else (e.g. Supabase API calls) — leave to the browser.
});
